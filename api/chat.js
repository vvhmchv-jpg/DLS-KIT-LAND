export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "DLS AI",
      endpoint: "/api/chat"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  return res.status(200).json({
    ok: true,
    message: "POST endpoint is working"
  });
}
