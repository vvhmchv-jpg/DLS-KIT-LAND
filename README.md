# DLS KIT LAND — OpenAI API Ready

This package keeps the OpenAI API key on the Vercel server and connects the DLS AI chat to `/api/chat`.

## Deploy

1. Upload these files to the GitHub repository connected to your Vercel project.
2. Keep `OPENAI_API_KEY` only in Vercel Environment Variables. Do not put the real key in `index.html` or GitHub.
3. Redeploy after changing environment variables.
4. Open the site and use DLS AI.

## Files

- `index.html` — DLS KIT LAND site with online AI chat connection and local fallback.
- `api/chat.js` — server-side OpenAI Responses API endpoint.
- `package.json` — official OpenAI JavaScript SDK dependency.
- `.env.example` — variable name only; no real secret.
