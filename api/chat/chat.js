export default async function handler(req, res) {
  try {
    console.log("[DLS AI] stage=START method=", req.method);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).json({
        ok: true,
        diagnostic: true,
        stage: "OPTIONS"
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        service: "DLS KIT LAND AI",
        diagnostic: true,
        stage: "GET_OK",
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        model: "gpt-5.6-luna"
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        diagnostic: true,
        stage: "BAD_METHOD",
        error: "Method Not Allowed"
      });
    }

    console.log("[DLS AI] stage=POST_STARTED");

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("[DLS AI] stage=NO_API_KEY");

      return res.status(500).json({
        ok: false,
        diagnostic: true,
        stage: "NO_API_KEY",
        error: "OPENAI_API_KEY is missing in Vercel"
      });
    }

    console.log("[DLS AI] stage=API_KEY_OK");

    let body = req.body;

    console.log("[DLS AI] body_type=", typeof body);

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        console.error(
          "[DLS AI] stage=BODY_JSON_PARSE_ERROR",
          parseError
        );

        return res.status(400).json({
          ok: false,
          diagnostic: true,
          stage: "BODY_JSON_PARSE_ERROR",
          error: "Request body is not valid JSON"
        });
      }
    }

    body = body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    console.log(
      "[DLS AI] message_length=",
      message.length
    );

    if (!message) {
      return res.status(400).json({
        ok: false,
        diagnostic: true,
        stage: "EMPTY_MESSAGE",
        error: "Message is required"
      });
    }

    console.log("[DLS AI] stage=BEFORE_OPENAI");

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

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
      }
    );

    console.log(
      "[DLS AI] stage=OPENAI_RETURNED status=",
      response.status
    );

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        raw
      };
    }

    if (!response.ok) {
      const apiError =
        data?.error?.message ||
        data?.error?.code ||
        data?.raw ||
        "OpenAI request failed";

      console.error(
        "[DLS AI] stage=OPENAI_ERROR",
        {
          status: response.status,
          error: apiError
        }
      );

      return res.status(response.status).json({
        ok: false,
        diagnostic: true,
        stage: "OPENAI_ERROR",
        status: response.status,
        error: apiError
      });
    }

    const reply =
      data?.output_text ||
      data?.output
        ?.filter(
          item => item.type === "message"
        )
        ?.flatMap(
          item => item.content || []
        )
        ?.filter(
          item => item.type === "output_text"
        )
        ?.map(
          item => item.text
        )
        ?.join("\n") ||
      "";

    if (!reply.trim()) {
      return res.status(502).json({
        ok: false,
        diagnostic: true,
        stage: "EMPTY_OPENAI_RESPONSE",
        error: "OpenAI returned no text"
      });
    }

    console.log(
      "[DLS AI] stage=SUCCESS"
    );

    return res.status(200).json({
      ok: true,
      diagnostic: true,
      stage: "SUCCESS",
      reply: reply.trim()
    });

  } catch (error) {
    console.error(
      "[DLS AI] stage=UNCAUGHT_ERROR",
      error
    );

    return res.status(500).json({
      ok: false,
      diagnostic: true,
      stage: "UNCAUGHT_ERROR",
      error:
        error?.message ||
        String(error),
      errorName:
        error?.name ||
        "UnknownError"
    });
  }
}
