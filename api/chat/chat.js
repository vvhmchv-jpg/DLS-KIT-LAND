export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "DLS KIT LAND AI",
      endpoint: "/api/chat",
      model: "gpt-5.6-luna"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is missing in Vercel"
      });
    }

    const body = req.body || {};
    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message is required"
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;

    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          instructions:
            "تو DLS AI دستیار سایت DLS KIT LAND هستی. " +
            "به فارسی و واضح درباره Dream League Soccer 2019، " +
            "کیت‌ها، تیم‌ها و امکانات سایت پاسخ بده.",
          input: message
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();

    let data = {};

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        raw
      };
    }

    if (!response.ok) {
      console.error("OPENAI ERROR:", data);

      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          data?.error?.code ||
          data?.raw ||
          `OpenAI HTTP ${response.status}`
      });
    }

    const reply =
      data?.output_text ||
      data?.output
        ?.filter(item => item.type === "message")
        ?.flatMap(item => item.content || [])
        ?.filter(item => item.type === "output_text")
        ?.map(item => item.text)
        ?.join("\n") ||
      "";

    if (!reply.trim()) {
      console.error("EMPTY OPENAI RESPONSE:", data);

      return res.status(502).json({
        ok: false,
        error: "OpenAI returned no text"
      });
    }

    return res.status(200).json({
      ok: true,
      reply: reply.trim()
    });

  } catch (error) {
    console.error("DLS AI ERROR:", error);

    if (error?.name === "AbortError") {
      return res.status(504).json({
        ok: false,
        error: "OpenAI request timed out after 30 seconds"
      });
    }

    return res.status(500).json({
      ok: false,
      error: error?.message || "Server error"
    });
  }
            }
