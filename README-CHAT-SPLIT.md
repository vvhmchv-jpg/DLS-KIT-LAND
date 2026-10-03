# DLS KIT LAND — External Chatbot

The chatbot UI/client is outside `index.html`.

- `chat.js` — injects the DLS AI UI, handles chat, calls `/api/chat`, and keeps a local fallback.
- `chat.css` — chatbot-only styles.
- `api/chat.js` — Vercel server function; keeps `OPENAI_API_KEY` server-side and calls the OpenAI Responses API.
- `index.html` — site only; it loads `/chat.css` and `/chat.js`.

## Vercel environment variables

Required:
- `OPENAI_API_KEY`

Optional:
- `OPENAI_MODEL` (default: `gpt-6-luna`)

After changing environment variables, redeploy the Vercel project.

The client automatically falls back to the local DLS answer engine if the API is unavailable, so the rest of the site remains usable.
