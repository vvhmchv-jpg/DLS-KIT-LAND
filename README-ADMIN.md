# DLS KIT LAND — Secure Admin

## Vercel Environment Variables

Set these in **Production**:

- `ADMIN_CODE` = your private admin code
- `ADMIN_SESSION_SECRET` = a long random secret (at least 32 characters)

Do not put either value in `index.html` or GitHub.

After changing environment variables, create a new Vercel deployment.

## Included

- `index.html` — site UI and admin panel
- `api/admin-auth.js` — server-side login/session verification

The admin panel is rendered as a login screen until the server confirms an authenticated admin session.
