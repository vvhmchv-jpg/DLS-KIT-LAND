const crypto = require("crypto");

const COOKIE = "__Host-dls_admin_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const aa = crypto.createHash("sha256").update(String(a)).digest();
  const bb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(aa, bb);
}

function getCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}

function validSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const token = getCookies(req)[COOKIE];
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function makeSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const payload = base64url(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    nonce: crypto.randomBytes(18).toString("hex")
  }));
  return payload + "." + sign(payload, secret);
}

module.exports = async function handler(req, res) {
  const action = new URL(req.url, "https://dls-kit-land.vercel.app").searchParams.get("action") || "session";
  const configured = Boolean(process.env.ADMIN_CODE && process.env.ADMIN_SESSION_SECRET);

  if (action === "session") {
    return json(res, 200, { authenticated: configured && validSession(req) });
  }

  if (action === "logout") {
    res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
    return json(res, 200, { ok: true });
  }

  if (action !== "login" || req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  if (!configured) {
    return json(res, 500, { ok: false, error: "Admin authentication is not configured on Vercel." });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    return json(res, 400, { ok: false, error: "Invalid request." });
  }

  const code = String(body.code || "");
  if (!code || !safeEqual(code, process.env.ADMIN_CODE)) {
    return json(res, 401, { ok: false, error: "کد مدیریت نادرست است." });
  }

  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(makeSession())}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return json(res, 200, { ok: true });
};
