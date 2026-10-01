export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET test
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "DLS KIT LAND AI",
      endpoint: "/api/chat",
      model: "gpt-5.6-luna"
    });
  }

  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  try {
    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is not configured on Vercel"
      });
    }

    // Read body
    const body = req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const context = body.context || {};

    // Validate message
    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message is required"
      });
    }

    // Prevent extremely large requests
    if (message.length > 8000) {
      return res.status(413).json({
        ok: false,
        error: "Message is too long"
      });
    }

    // Always use the intended DLS KIT LAND model
    const selectedModel = "gpt-5.6-luna";

    // OpenAI Responses API
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: selectedModel,

          instructions:
            "تو DLS AI دستیار سایت DLS KIT LAND هستی. " +
            "درباره Dream League Soccer 2019، کیت‌ها، تیم‌ها، " +
            "قالب کیت، لینک کیت و امکانات سایت به فارسی، واضح و کوتاه پاسخ بده.",

          input: [
            {
              role: "user",
              content: message
            }
          ],

          metadata: {
            source: "DLS KIT LAND",
            language: "fa",
            page: String(context.page || "")
          }
        })
      }
    );

    // Read OpenAI response
    const data = await response.json();

    // OpenAI error
    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          data?.error?.code ||
          "OpenAI API request failed"
      });
    }

    // Extract answer
    const reply =
      typeof data.output_text === "string"
        ? data.output_text.trim()
        : "";

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "OpenAI returned an empty response"
      });
    }

    // Success
    return res.status(200).json({
      ok: true,
      reply,
      model: selectedModel
    });

  } catch (error) {
    console.error("DLS KIT LAND AI error:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "AI request failed"
    });
  }
}
