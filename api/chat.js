import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const { message, model } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const response = await client.responses.create({
      model: model || "gpt-5.6-luna",
      instructions:
        "You are the AI assistant for DLS KIT LAND. Help users with Dream League Soccer 2019 kits, teams, seasons, kit types, downloading kits, and using the website. Answer clearly and concisely.",
      input: message
    });

    return res.status(200).json({
      reply: response.output_text
    });

  } catch (error) {
    console.error("OpenAI API error:", error);

    return res.status(500).json({
      error: "AI request failed"
    });
  }
}
