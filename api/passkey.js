const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const crypto = require("crypto");

process.env.CBOR_NATIVE_ACCELERATION_DISABLED = "true";

const RP_NAME = "DLS KIT LAND";
const RP_ID = process.env.PASSKEY_RP_ID || "dls-kit-land.vercel.app";
const ORIGIN = process.env.PASSKEY_ORIGIN || `https://${RP_ID}`;
const SECRET = process.env.PASSKEY_SECRET;
const SETUP_SECRET = process.env.PASSKEY_SETUP_SECRET;

// Durable server-side storage is required because Vercel Functions are stateless.
// Create a Vercel Blob store and attach it to this project.
const BLOB_PATH = "dls-kit-land/admin/passkey.json";

const COOKIE_BASE = "__Host-dls_";
const SESSION_TTL = 60 * 60 * 12;
const CHALLENGE_TTL = 5 * 60;
const CREDENTIAL_TTL = 60 * 60 * 24 * 365 * 5;

function b64u(buf) {
  return Buffer.from(buf).toString("base64url");
}

function fromB64u(value) {
  return Buffer.from(value, "base64url");
}

function sign(value) {
  if (!SECRET) return "";
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

  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(fromB64u(raw).toString("utf8"));
  } catch {
    return null;
  }
}

function cookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1));
    }
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
  const list = previous
    ? (Array.isArray(previous) ? previous : [previous])
    : [];

  res.setHeader("Set-Cookie", [...list, attrs.join("; ")]);
}

function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
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
    json(res, 500, {
      error: "PASSKEY_SECRET is not configured.",
      code: "MISSING_SECRET",
    });
    return false;
  }
  return true;
}

async function blobSDK() {
  return import("@vercel/blob");
}

async function loadCredential() {
  const { get } = await blobSDK();

  try {
    const result = await get(BLOB_PATH, {
      access: "private",
      useCache: false,
    });

    if (!result) return null;

    const text = await new Response(result.stream).text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    // A missing object means that the admin device has not been registered yet.
    const status = error?.statusCode || error?.status || error?.response?.status;
    if (status === 404) return null;
    throw error;
  }
}

async function saveCredential(credential, allowOverwrite = false) {
  const { put } = await blobSDK();

  await put(BLOB_PATH, JSON.stringify(credential), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json",
  });
}

function publicCredential(credential) {
  return {
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports || [],
  };
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

    if (action === "status") {
      const credential = await loadCredential();
      return json(res, 200, {
        registered: !!credential,
        origin: ORIGIN,
        rpId: RP_ID,
      });
    }

    if (action === "register-options") {
      if (!SETUP_SECRET) {
        return json(res, 500, {
          error: "PASSKEY_SETUP_SECRET is not configured.",
          code: "MISSING_SETUP_SECRET",
        });
      }

      const body = await readBody(req);
      if (!body.setupSecret || body.setupSecret !== SETUP_SECRET) {
        return json(res, 403, {
          error: "Invalid setup secret.",
          code: "INVALID_SETUP_SECRET",
        });
      }

      const existingCredential = await loadCredential();
      if (existingCredential) {
        return json(res, 409, {
          error: "Admin device is already registered. A second device cannot be registered.",
          code: "ADMIN_ALREADY_REGISTERED",
        });
      }

      const userID = crypto.randomBytes(32);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: "DLS KIT LAND Admin",
        userDisplayName: "DLS KIT LAND Admin",
        userID,
        attestationType: "none",
        authenticatorSelection: {
          // Android + Google Password Manager: require a discoverable credential
          // and require user verification by the phone's screen lock.
          residentKey: "required",
          userVerification: "required",
          // Prefer the authenticator built into the current phone.
          authenticatorAttachment: "platform",
        },
        // Prevent registering the same credential twice if a previous ceremony exists.
        excludeCredentials: [],
        supportedAlgorithmIDs: [-7, -257],
      });

      setCookie(res, `${COOKIE_BASE}reg`, pack({
        challenge: options.challenge,
        userID: b64u(userID),
        exp: Date.now() + CHALLENGE_TTL * 1000,
      }), CHALLENGE_TTL);

      return json(res, 200, options);
    }

    if (action === "register-verify") {
      const reg = unpack(c[`${COOKIE_BASE}reg`]);
      if (!reg || reg.exp < Date.now()) {
        return json(res, 400, {
          error: "Registration challenge expired. Start registration again.",
          code: "REGISTRATION_EXPIRED",
        });
      }

      // Re-check the durable store immediately before accepting the first credential.
      const alreadyRegistered = await loadCredential();
      if (alreadyRegistered) {
        clearCookie(res, `${COOKIE_BASE}reg`);
        return json(res, 409, {
          error: "Admin device is already registered. A second device cannot be registered.",
          code: "ADMIN_ALREADY_REGISTERED",
        });
      }

      const body = await readBody(req);

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: reg.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo?.credential) {
        return json(res, 400, {
          verified: false,
          error: "Passkey registration verification failed.",
          code: "REGISTRATION_VERIFY_FAILED",
        });
      }

      const { credential } = verification.registrationInfo;
      const stored = {
        version: 1,
        createdAt: new Date().toISOString(),
        id: credential.id,
        publicKey: b64u(credential.publicKey),
        counter: credential.counter,
        transports: body.response?.transports || [],
      };

      try {
        // allowOverwrite=false makes the first successful registration win.
        await saveCredential(stored, false);
      } catch (error) {
        // If another request won the race, do not replace the existing admin.
        const afterRace = await loadCredential().catch(() => null);
        if (afterRace) {
          clearCookie(res, `${COOKIE_BASE}reg`);
          return json(res, 409, {
            error: "Admin device is already registered. A second device cannot be registered.",
            code: "ADMIN_ALREADY_REGISTERED",
          });
        }
        throw error;
      }

      setCookie(res, `${COOKIE_BASE}session`, pack({
        exp: Date.now() + SESSION_TTL * 1000,
      }), SESSION_TTL);
      clearCookie(res, `${COOKIE_BASE}reg`);

      return json(res, 200, { verified: true });
    }

    if (action === "login-options") {
      const credential = await loadCredential();
      if (!credential) {
        return json(res, 404, {
          error: "No admin Passkey is registered yet. Register this phone first.",
          code: "NO_ADMIN_CREDENTIAL",
        });
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: "required",
        allowCredentials: [{
          id: credential.id,
          transports: credential.transports || [],
        }],
      });

      setCookie(res, `${COOKIE_BASE}auth`, pack({
        challenge: options.challenge,
        exp: Date.now() + CHALLENGE_TTL * 1000,
      }), CHALLENGE_TTL);

      return json(res, 200, options);
    }

    if (action === "login-verify") {
      const auth = unpack(c[`${COOKIE_BASE}auth`]);
      const credential = await loadCredential();

      if (!auth || auth.exp < Date.now()) {
        return json(res, 400, {
          error: "Authentication challenge expired. Start login again.",
          code: "AUTH_EXPIRED",
        });
      }

      if (!credential) {
        return json(res, 404, {
          error: "No admin Passkey is registered.",
          code: "NO_ADMIN_CREDENTIAL",
        });
      }

      const body = await readBody(req);
      if (body.id !== credential.id) {
        return json(res, 403, {
          error: "This Passkey is not the registered admin Passkey.",
          code: "UNKNOWN_PASSKEY",
        });
      }

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

      if (!verification.verified) {
        return json(res, 401, {
          verified: false,
          error: "Phone verification failed.",
          code: "AUTH_VERIFY_FAILED",
        });
      }

      const newCounter = verification.authenticationInfo.newCounter;
      const updated = {
        ...credential,
        counter: newCounter,
        lastUsedAt: new Date().toISOString(),
      };

      await saveCredential(updated, true);

      setCookie(res, `${COOKIE_BASE}session`, pack({
        exp: Date.now() + SESSION_TTL * 1000,
      }), SESSION_TTL);
      clearCookie(res, `${COOKIE_BASE}auth`);

      return json(res, 200, { verified: true });
    }

    if (action === "logout") {
      clearCookie(res, `${COOKIE_BASE}session`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, {
      error: "Unknown action.",
      code: "UNKNOWN_ACTION",
    });
  } catch (error) {
    console.error("DLS Passkey error:", error);
    return json(res, 500, {
      error: error?.message || "Passkey operation failed.",
      code: "PASSKEY_SERVER_ERROR",
    });
  }
};
