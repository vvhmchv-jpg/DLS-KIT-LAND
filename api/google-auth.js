const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const COOKIE = '__Host-dls_google_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.GOOGLE_SESSION_SECRET || '')
    .update(value)
    .digest('base64url');
}

function makeSession(email) {
  const payload = base64url(JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE
  }));
  return `${payload}.${sign(payload)}`;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const i = item.indexOf('=');
    if (i < 0) continue;
    const k = item.slice(0, i).trim();
    if (k === name) return decodeURIComponent(item.slice(i + 1));
  }
  return null;
}

function getSession(req) {
  const value = readCookie(req, COOKIE);
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !process.env.GOOGLE_SESSION_SECRET) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    if (!isAllowed(data.email)) return null;
    return data;
  } catch {
    return null;
  }
}

function isAllowed(email) {
  const allowed = String(process.env.GOOGLE_ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(allowed) && String(email || '').trim().toLowerCase() === allowed;
}

function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const method = req.method || 'GET';
  const url = new URL(req.url, `https://${req.headers.host || 'dls-kit-land.vercel.app'}`);
  const action = url.searchParams.get('action') || 'session';

  if (!process.env.GOOGLE_CLIENT_ID) {
    return send(res, 500, { ok: false, error: 'GOOGLE_CLIENT_ID is not configured.' });
  }
  if (!process.env.GOOGLE_ADMIN_EMAIL) {
    return send(res, 500, { ok: false, error: 'GOOGLE_ADMIN_EMAIL is not configured.' });
  }
  if (!process.env.GOOGLE_SESSION_SECRET) {
    return send(res, 500, { ok: false, error: 'GOOGLE_SESSION_SECRET is not configured.' });
  }

  if (action === 'config' && method === 'GET') {
    return send(res, 200, { ok: true, clientId: process.env.GOOGLE_CLIENT_ID });
  }

  if (action === 'session' && method === 'GET') {
    const session = getSession(req);
    return send(res, 200, {
      ok: true,
      authenticated: Boolean(session),
      email: session?.email || null
    });
  }

  if (action === 'logout' && method === 'POST') {
    return send(res, 200, { ok: true }, {
      'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    });
  }

  if (action === 'login' && method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    } catch {
      return send(res, 400, { ok: false, error: 'Invalid JSON.' });
    }

    const credential = String(body.credential || '');
    if (!credential) return send(res, 400, { ok: false, error: 'Google credential is missing.' });

    try {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      const email = payload?.email || '';
      const emailVerified = payload?.email_verified === true;

      if (!emailVerified || !isAllowed(email)) {
        return send(res, 403, { ok: false, error: 'This Google account is not authorized for DLS KIT LAND Admin.' });
      }

      const session = makeSession(email.toLowerCase());
      return send(res, 200, { ok: true, email: email.toLowerCase() }, {
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`
      });
    } catch (error) {
      return send(res, 401, { ok: false, error: 'Google sign-in verification failed.' });
    }
  }

  return send(res, 404, { ok: false, error: 'Unknown action.' });
};
