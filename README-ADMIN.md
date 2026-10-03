# DLS KIT LAND — Secure Admin

- Admin section is rendered only after a valid server-side admin session.
- Admin code is NOT stored in `index.html`.
- Configure Vercel Environment Variables:
  - `ADMIN_CODE` = your private admin code
  - `ADMIN_SESSION_SECRET` = a long random secret
- Redeploy after changing environment variables.
- After login, the admin can add/delete kits and add/delete teams. Deleting a team also deletes its associated kits.
- Current archive edits are stored in the browser's local database. For a shared public archive across all visitors, connect the admin API to persistent storage (Vercel Blob/GitHub/DB) in the next step.
