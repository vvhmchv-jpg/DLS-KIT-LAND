DLS KIT LAND — Google-only Admin Login

What changed
- Passkey/WebAuthn is removed from the admin login.
- Vercel Blob is not used for authentication.
- Admin login uses Google Identity Services.
- Only the exact email in GOOGLE_ADMIN_EMAIL can enter Admin.
- The Google ID token is verified server-side with google-auth-library.
- The browser receives only a signed HttpOnly session cookie.

Files
- index.html
- api/google-auth.js
- package.json

Vercel Environment Variables (Production)
1) GOOGLE_CLIENT_ID = your Google OAuth Web Client ID
2) GOOGLE_ADMIN_EMAIL = the exact Google account email you want to allow
3) GOOGLE_SESSION_SECRET = a long random secret (at least 32 random characters)

Google Cloud setup
1) Open Google Cloud Console.
2) Create/select a project.
3) Configure the OAuth consent screen / Google Identity Services.
4) Create an OAuth Client ID of type Web application.
5) Add this Authorized JavaScript origin:
   https://dls-kit-land.vercel.app
6) Copy the Web Client ID into GOOGLE_CLIENT_ID in Vercel.

Vercel setup
1) Replace your old index.html with this index.html.
2) Replace/create api/google-auth.js.
3) Replace package.json with this package.json.
4) Delete the old api/passkey.js if it is still in the repo.
5) Remove old Passkey/Blob environment variables if you no longer need them.
6) Add the 3 Google environment variables above.
7) Redeploy Production.

How it works
Admin button -> Google sign-in -> server verifies Google ID token -> server checks GOOGLE_ADMIN_EMAIL -> signed HttpOnly session -> Admin panel.

Important
- GOOGLE_CLIENT_ID is not a password.
- GOOGLE_SESSION_SECRET and any other secret must stay server-side; never put them in index.html.
- This protects the Admin UI with Google authentication. The site's kit database is still browser/localStorage-based, as in the original DLS KIT LAND version.
