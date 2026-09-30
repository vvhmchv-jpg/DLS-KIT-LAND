import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "DLS AI", endpoint: "/api/chat" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, model, context } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const selectedModel = model || "gpt-5.6-luna";

    const response = await client.responses.create({
      model: selectedModel,
      instructions: [
        "You are DLS AI for DLS KIT LAND.",
        "Help users with Dream League Soccer 2019 kits, teams, seasons, kit types, direct kit links, search, and website features.",
        "Answer in the user's language. If the user writes Persian, answer in Persian.",
        "Be concise and useful. Do not invent a direct download URL when the website has not provided one.",
        `Website context: ${JSON.stringify(context || {})}`
      ].join("\n"),
      input: message
    });

    return res.status(200).json({
      reply: response.output_text || "پاسخی از مدل دریافت نشد."
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

    const status = Number(error?.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    return res.status(safeStatus).json({
      error: error?.message || "AI request failed"
    });
  }
}
