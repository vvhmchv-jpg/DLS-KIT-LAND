import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // تست اتصال
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "DLS AI",
      endpoint: "/api/chat",
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed",
    });
  }

  try {
    const body = req.body || {};
    const message = body.message;
    const context = body.context || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Message is required",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is missing",
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.6-luna",

      instructions: `
You are DLS AI for DLS KIT LAND.

Help users with:
- Dream League Soccer 2019
- football kits
- teams
- seasons
- home/away/third kits
- goalkeeper kits
- kit links
- kit searching
- website features

Answer in the same language as the user.
If the user writes Persian, answer in Persian.

Be concise and useful.
Never invent a direct download URL.
If a link is not available in the website data, say so.

Website context:
${JSON.stringify(context)}
      `,

      input: message,

      max_output_tokens: 500,
    });

    return res.status(200).json({
      ok: true,
      reply: response.output_text || "پاسخی از مدل دریافت نشد.",
    });

  } catch (error) {
    console.error("DLS AI ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "OpenAI request failed",
      type: error?.type || null,
      code: error?.code || null,
      request_id: error?._request_id || null,
    });
  }
}
