export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "DLS KIT LAND AI",
    message: "API is working"
  });
}
