# DLS KIT LAND — Final integrated version

This package keeps the existing DLS KIT LAND local-AI site and adds:

- Your DLS KIT LAND channel logo in the header
- A custom shield/football DLS AI icon
- Persian/English switch with RTL/LTR switching
- Local DLS AI with Persian + English answers
- Passkey-protected Admin section
- Phone biometric/device-PIN verification through WebAuthn/Passkey

## Vercel setup

Add these Environment Variables to the Vercel project:

- `PASSKEY_SECRET` = a long random secret (32+ random characters)
- `PASSKEY_SETUP_SECRET` = a separate one-time setup secret that only you know
- `PASSKEY_RP_ID` = `dls-kit-land-h2ah.vercel.app`
- `PASSKEY_ORIGIN` = `https://dls-kit-land-h2ah.vercel.app`
- `CBOR_NATIVE_ACCELERATION_DISABLED` = `true`

Then deploy the folder.

First admin setup:
1. Open DLS KIT LAND over HTTPS.
2. Tap ⚙️ Admin.
3. Tap “Register this device”.
4. Enter the `PASSKEY_SETUP_SECRET` you set in Vercel.
5. Approve the phone prompt with fingerprint/face/PIN.
6. After that, Admin opens through Passkey.

The website never receives or stores the phone's password/PIN/biometric data.

Important: the current Admin editor is still a local browser database editor. Passkey protects access to the Admin UI/session; it does not turn the local JSON/IndexedDB-style browser data into a server database.
