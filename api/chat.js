const crypto = require("crypto");

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const SYSTEM_INSTRUCTIONS = `You are DLS AI, the assistant for DLS KIT LAND.
Focus on Dream League Soccer 2019 kits, teams, seasons, Home/Away/Third/Goalkeeper kits, direct PNG links, kit templates, kit dimensions, logos, kit troubleshooting, and how to use DLS KIT LAND.
Answer in Persian when the user writes Persian and in English when the user writes English.
Be concise, practical, and honest. Do not invent kit links, database entries, or site features. If the site data is not available to you, say so and ask for the team/season/type needed.`;

function json(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 100000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).filter(item =>
    item && (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string" && item.content.trim().length <= 4000
  ).map(item => ({ role: item.role, content: item.content.trim() }));
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (String(req.query?.action || "") === "health") {
      return json(res, 200, {
        ok: true,
        service: "DLS KIT LAND AI",
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: MODEL
      });
    }
    return json(res, 200, {
      ok: true,
      service: "DLS KIT LAND AI",
      endpoint: "/api/chat",
      model: MODEL
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { ok: false, error: "OPENAI_API_KEY is not configured on Vercel." });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message || "Invalid request." });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json(res, 400, { ok: false, error: "Message is required." });
  if (message.length > 4000) return json(res, 413, { ok: false, error: "Message is too long." });

  const history = cleanHistory(body.history);
  const input = [...history, { role: "user", content: message }];

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        max_output_tokens: 500
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = data?.error?.message || `OpenAI request failed (${upstream.status}).`;
      return json(res, upstream.status >= 500 ? 502 : upstream.status, { ok: false, error: message });
    }

    const reply = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (!reply) return json(res, 502, { ok: false, error: "The AI returned an empty response." });

    return json(res, 200, { ok: true, reply, model: data.model || MODEL });
  } catch (error) {
    return json(res, 502, { ok: false, error: error?.message || "Could not reach OpenAI." });
  }
};
