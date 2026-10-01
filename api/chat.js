export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "DLS KIT LAND AI",
      endpoint: "/api/chat"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const { message, model, context } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured on Vercel"
      });
    }

    const selectedModel = model || "gpt-5.6-luna";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions:
          "تو DLS AI دستیار سایت DLS KIT LAND هستی. درباره Dream League Soccer 2019، تیم‌ها، کیت‌ها و امکانات سایت به فارسی و واضح پاسخ بده.",
        input: [
          {
            role: "user",
            content: message
          }
        ],
        metadata: {
          source: "DLS KIT LAND",
          language: "fa",
          page: String(context?.page || "")
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI API request failed"
      });
    }

    return res.status(200).json({
      reply:
        data.output_text ||
        "پاسخی از مدل دریافت نشد."
    });

  } catch (error) {
    console.error("DLS AI server error:", error);

    return res.status(500).json({
      error: error?.message || "AI request failed"
    });
  }
}
