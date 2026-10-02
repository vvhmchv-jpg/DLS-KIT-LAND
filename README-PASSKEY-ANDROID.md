# DLS KIT LAND — Android Passkey Admin

## What this version does

- Uses WebAuthn / Passkey for the admin panel.
- Registration is allowed only once on the server.
- The credential is stored durably in a private Vercel Blob object, not in a browser cookie.
- Login is restricted to the stored credential.
- Android/Chrome + Google Password Manager performs phone user verification.
- The website never receives the phone pattern, PIN, fingerprint, or face data.
- The frontend uses SimpleWebAuthn Browser 14 from the CDN.

## Important limitation

A normal Google Password Manager passkey can be synchronized to other devices. Therefore a website cannot guarantee that the same cryptographic passkey will remain physically confined to one handset. This project does enforce one server-side registered credential and prefers the current phone's platform authenticator, but Google sync can still make that passkey available elsewhere.

## Vercel setup

1. Create a **Private Vercel Blob store** and attach it to the `dls-kit-land` Vercel project.
2. Vercel will provide the Blob authentication environment for the project. If your store uses a token instead of OIDC, keep `BLOB_READ_WRITE_TOKEN` available to the Function.
3. Keep these environment variables in **Production**:

```text
PASSKEY_RP_ID=dls-kit-land.vercel.app
PASSKEY_ORIGIN=https://dls-kit-land.vercel.app
PASSKEY_SECRET=<long-random-secret>
PASSKEY_SETUP_SECRET=<private-one-time-registration-secret>
```

4. Redeploy after changing code or environment variables.

## First registration on the phone

1. Open `https://dls-kit-land.vercel.app` in Chrome on the Android phone.
2. Open Admin.
3. Tap **Register this phone**.
4. Enter `PASSKEY_SETUP_SECRET`.
5. Google Password Manager should show the passkey creation screen.
6. Tap **Continue**.
7. When Android asks to verify the device, use the phone's normal screen lock (pattern/PIN/biometric).
8. After success, the admin page opens.

## Later logins

Tap Admin -> **Sign in with Passkey** and approve the Android device verification.

## If registration was interrupted

If Google Password Manager created a local passkey but the server did not finish registration, remove the unfinished DLS KIT LAND passkey from Google Password Manager and run registration again. This avoids an `InvalidStateError` from attempting to create the same credential twice.

## Do not put these values in index.html

Never put `PASSKEY_SECRET`, `PASSKEY_SETUP_SECRET`, or a Blob token in client-side HTML/JavaScript.
