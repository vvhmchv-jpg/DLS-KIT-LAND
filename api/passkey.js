const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const crypto = require("crypto");

process.env.CBOR_NATIVE_ACCELERATION_DISABLED = "true";

const RP_NAME = "DLS KIT LAND";
const RP_ID = process.env.PASSKEY_RP_ID || "dls-kit-land-h2ah.vercel.app";
const ORIGIN = process.env.PASSKEY_ORIGIN || `https://${RP_ID}`;
const SECRET = process.env.PASSKEY_SECRET;
const SETUP_SECRET = process.env.PASSKEY_SETUP_SECRET;

const COOKIE_BASE = "__Host-dls_";
const SESSION_TTL = 60 * 60 * 12;

function b64u(buf) {
  return Buffer.from(buf).toString("base64url");
}
function fromB64u(value) {
  return Buffer.from(value, "base64url");
}
function sign(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}
function pack(obj) {
  const raw = b64u(Buffer.from(JSON.stringify(obj), "utf8"));
  return `${raw}.${sign(raw)}`;
}
function unpack(value) {
  if (!value || !SECRET) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const raw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(raw);
  if (sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(fromB64u(raw).toString("utf8")); } catch { return null; }
}
function cookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}
function setCookie(res, name, value, maxAge) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  const previous = res.getHeader("Set-Cookie");
  const list = previous ? (Array.isArray(previous) ? previous : [previous]) : [];
  res.setHeader("Set-Cookie", [...list, attrs.join("; ")]);
}
function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
function requireConfig(res) {
  if (!SECRET) {
    json(res, 500, { error: "PASSKEY_SECRET is not configured." });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  if (!requireConfig(res)) return;

  const action = String(req.query?.action || "session");
  const c = cookies(req);

  try {
    if (action === "session") {
      const session = unpack(c[`${COOKIE_BASE}session`]);
      const authenticated = !!session && session.exp > Date.now();
      if (!authenticated) clearCookie(res, `${COOKIE_BASE}session`);
      return json(res, 200, { authenticated });
    }

    if (action === "register-options") {
      if (!SETUP_SECRET) return json(res, 500, { error: "PASSKEY_SETUP_SECRET is not configured." });

      // SINGLE-ADMIN-DEVICE: once a credential exists, no second device can register.
      const existingCredential = unpack(c[`${COOKIE_BASE}credential`]);
      if (existingCredential) {
        return json(res, 409, {
          error: "Admin device is already registered. A second device is not allowed."
        });
      }

      const body = await readBody(req);
      if (!body.setupSecret || body.setupSecret !== SETUP_SECRET) {
        return json(res, 403, { error: "Invalid setup secret." });
      }

      const userId = crypto.randomBytes(16);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: "DLS KIT LAND Admin",
        userDisplayName: "DLS KIT LAND Admin",
        userID: userId,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
          authenticatorAttachment: "platform",
        },
        supportedAlgorithmIDs: [-7, -257],
      });

      setCookie(res, `${COOKIE_BASE}reg`, pack({
        challenge: options.challenge,
        userID: b64u(userId),
        exp: Date.now() + 5 * 60 * 1000
      }), 300);

      return json(res, 200, options);
    }

    if (action === "register-verify") {
      const reg = unpack(c[`${COOKIE_BASE}reg`]);
      if (!reg || reg.exp < Date.now()) return json(res, 400, { error: "Registration challenge expired." });

      const body = await readBody(req);
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: reg.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });

      if (!verification.verified) return json(res, 400, { verified: false });

      const { credential } = verification.registrationInfo;
      const passkey = {
        id: credential.id,
        publicKey: b64u(credential.publicKey),
        counter: credential.counter,
        transports: body.response?.transports || [],
      };

      setCookie(res, `${COOKIE_BASE}credential`, pack(passkey), 60 * 60 * 24 * 365 * 2);
      setCookie(res, `${COOKIE_BASE}session`, pack({ exp: Date.now() + SESSION_TTL * 1000 }), SESSION_TTL);
      clearCookie(res, `${COOKIE_BASE}reg`);
      return json(res, 200, { verified: true });
    }

    if (action === "login-options") {
      const credential = unpack(c[`${COOKIE_BASE}credential`]);
      const allowCredentials = credential ? [{
        id: credential.id,
        transports: credential.transports || [],
      }] : [];

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: "required",
        allowCredentials,
      });

      setCookie(res, `${COOKIE_BASE}auth`, pack({
        challenge: options.challenge,
        exp: Date.now() + 5 * 60 * 1000
      }), 300);

      return json(res, 200, options);
    }

    if (action === "login-verify") {
      const auth = unpack(c[`${COOKIE_BASE}auth`]);
      const credential = unpack(c[`${COOKIE_BASE}credential`]);
      if (!auth || auth.exp < Date.now()) return json(res, 400, { error: "Authentication challenge expired." });
      if (!credential) return json(res, 404, { error: "No Passkey is registered on this browser." });

      const body = await readBody(req);
      if (body.id !== credential.id) return json(res, 403, { error: "Unknown Passkey." });

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: auth.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(fromB64u(credential.publicKey)),
          counter: credential.counter,
          transports: credential.transports || [],
        },
      });

      if (!verification.verified) return json(res, 401, { verified: false });

      const updated = {
        ...credential,
        counter: verification.authenticationInfo.newCounter
      };
      setCookie(res, `${COOKIE_BASE}credential`, pack(updated), 60 * 60 * 24 * 365 * 2);
      setCookie(res, `${COOKIE_BASE}session`, pack({ exp: Date.now() + SESSION_TTL * 1000 }), SESSION_TTL);
      clearCookie(res, `${COOKIE_BASE}auth`);
      return json(res, 200, { verified: true });
    }

    if (action === "logout") {
      clearCookie(res, `${COOKIE_BASE}session`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Unknown action." });
  } catch (error) {
    console.error("DLS Passkey error:", error);
    return json(res, 500, { error: error?.message || "Passkey operation failed." });
  }
};
