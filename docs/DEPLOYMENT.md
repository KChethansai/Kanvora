# Kanvora deployment checklist

Applies to the release commit `b985c441098943f29d4f5b0b8448b876606630bf`
(`Frontend/` on Vercel, `Backend/` on Render). Every value below is read by the
code at start-up; nothing is inferred or defaulted in production except where
this document says so.

> Nothing in this document is a secret. Provision credentials in the hosting
> provider's environment settings. Never commit them, never paste them into an
> issue, and never rotate a live signing key without accepting that every
> session is invalidated.

---

## 1. Build and start commands

| Piece | Install | Build | Run | Health |
| --- | --- | --- | --- | --- |
| `Backend/` (Render web service) | `npm ci` | none | `npm start` → `node server.js` | `GET /health`, `GET /health/ready` |
| `Frontend/` (Vercel project) | `npm ci` | `npm run build` (output `dist/`) | Vercel static hosting | `GET /` |

Set the **Vercel project root directory to `Frontend/`** — `Frontend/vercel.json`
(the SPA rewrite and the cache headers) is only read from there. With the root
set to the repository root the rewrite is ignored and every deep link
(`/projects/:id`, `/templates/:id`, `/main-page/profile`) returns 404 on
refresh.

## 2. Environment variables

### Backend runtime (Render)

| Variable | Required | Value / notes |
| --- | --- | --- |
| `NODE_ENV` | **yes** | exactly `production`. Anything else silently relaxes rate limits, the CSRF origin check, secure cookies and error redaction, and the server logs a warning at start-up. |
| `DB_URL` | **yes** | a **replica set** (MongoDB Atlas is one). Board, list, card, template and workspace mutations run in transactions; a standalone `mongod` fails every one of them with HTTP 500. |
| `SECRET_KEY` | **yes** | ≥ 32 characters, random, unique per environment. The server refuses to start otherwise (`SECRET_KEY must be at least 32 characters in production`). It signs sessions — changing it signs every user out. |
| `CLIENT_URL` | **yes** | comma-separated exact browser origins, **without a trailing slash**: `https://kanvora.example`. The first entry is also the base of the links in verification, reset and invitation email. A trailing slash makes every Socket.IO handshake fail while REST still works. |
| `TRUST_PROXY` | **yes** | integer 0–10, must be set explicitly in production. Use `1` behind a single proxy. `0` makes every client share one rate-limit bucket; too high lets clients spoof their IP. |
| `COOKIE_SAME_SITE` | **yes for a cross-site deployment** | `none` when the frontend and backend are on different sites (Vercel → Render). The default `lax` makes the browser drop the session cookie, so login appears to succeed and every later request returns 401. `secure` is enabled automatically in production. |
| `PORT` | no | Render injects it; defaults to `5000`. |
| `SESSION_TTL_DAYS` | no | 1–30, default 7. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | for mail | Without them the server still starts, accounts are created, and no mail is ever delivered — the failure is only visible in the log. Provision before opening registration. |
| `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM` | no | Port 587 by default; `EMAIL_FROM` falls back to `SMTP_USER`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | for uploads | All three or card/avatar uploads are rejected with HTTP 503. |
| `GOOGLE_CLIENT_ID` | no | Google sign-in is disabled without it (the button is not rendered; the API answers 503). The same id must be set on both sides. It is a public client id, not a secret. |

### Frontend build (Vercel)

| Variable | Required | Value / notes |
| --- | --- | --- |
| `VITE_API_URL` | **yes** | the public API origin, e.g. `https://api.kanvora.example`. A production build without it (or pointing at `localhost`) refuses to start and shows a "Kanvora is not configured" screen instead of silently failing every request. |
| `VITE_GOOGLE_CLIENT_ID` | no | must match the backend `GOOGLE_CLIENT_ID` if Google sign-in is offered. |

## 3. Database prerequisites

- A replica set is required, not optional: `mongodb://host/kanvora` pointing at a
  standalone `mongod` breaks every transactional write.
- The application user needs read/write on the application database.
- `Backend/tests/helpers/database.js` refuses any test URL that is not a local
  `kanvora_test*` database, so the test suite can never touch a production
  database.

## 4. Origin configuration

- `CLIENT_URL` (backend) and `VITE_API_URL` (frontend) must describe the same
  pair of origins. The REST CORS allowlist and the Socket.IO handshake check
  read the same `CLIENT_URL`; both compare exact origins.
- The browser origin includes the scheme and the port (`https://kanvora.example`),
  never a path, never a trailing slash.
- `COOKIE_SAME_SITE=none` requires HTTPS on both sides. Render and Vercel
  terminate TLS, so the cookies are `Secure` automatically in production.

## 5. Third-party services

- **SMTP** — needed for address verification, password reset and workspace
  invitations. Verify delivery with a real account before opening registration;
  a misconfigured transport fails quietly (the log line says
  `Account email delivery failed: SMTP transport is not configured`).
- **Cloudinary** — needed for card attachments and profile images. The API
  answers 503 with a clear message when it is missing.
- **Google OAuth** — optional. When enabled, the client id must be identical on
  both sides; a mismatch answers 401.

## 6. Post-deployment smoke tests

Run from an operator machine, against the deployed origins, with a disposable
account:

1. `curl -s https://api.kanvora.example/health` → `{"status":"ok",...}`.
2. `curl -s -o /dev/null -w '%{http_code}' https://api.kanvora.example/health/ready`
   → `200` (the database answers). `503` means the process is up but Mongo is
   not.
3. Open `https://kanvora.example` → the marketing shell renders and the header
   shows the sign-in state (not the "not configured" screen).
4. Register a disposable account, receive the verification email, verify, and
   sign in. The session cookie must be stored (`SameSite=None; Secure`).
5. Create a workspace, a board, a list and a card; open the same board in a
   second browser and confirm the change arrives over the socket (realtime
   needs a working `CLIENT_URL`).
6. Sign in as a second, viewer-role account and confirm the write controls are
   absent.
7. Switch the theme to Dark, then System, and reload: the choice must survive
   and System must follow the OS.

Anything that fails at step 4 or 5 is almost always the origin or cookie
configuration in §2, not the application code.

## 7. Confirming the deployed commit

- The API start-up log prints `Configuration: {...}` and the listening port; the
  frontend build id is visible in the Vercel deployment list.
- `GET /health` returns an `uptime` value — compare it with the deploy time.
- For the frontend, the hashed asset names in the page source come from the
  built commit; the Vercel deployment entry lists the source commit.
- The authoritative record is the repository: `git log -1 origin/main`.

## 8. Recognising and rolling back a defective release

Recognise it when: the health probe fails, sign-in returns 401 for every user,
realtime updates stop while REST works, the board renders empty, or the
frontend shows "Kanvora is not configured".

Rollback (no data migration is involved):

1. Frontend: Vercel → Deployments → promote the previous known-good
   deployment (instant, no rebuild).
2. Backend: Render → roll back to the previous deploy, or `git revert` the
   release commit and let CI redeploy.
3. If the session signing key was changed, restore the previous key — the
   sessions signed with it become valid again.
4. If a database migration was involved, stop and follow the migration's own
   rollback notes; the release does not change the schema.

## 9. Single-instance limitations

Run **one** backend instance. The following state lives in the process:

- Socket.IO rooms and presence (`project:<id>`, `user:<id>`): a second instance
  does not see the first instance's boards or presence.
- Session revocation (`revokeUserAccess`) disconnects sockets on the instance
  that performs it; another instance keeps the connection until the next
  authorized action.
- Rate limiting uses an in-memory store, so the effective limit multiplies with
  each instance and clients can spread requests across instances.
- Admission budgets for socket handshakes, joins and typing are per instance.

Scaling out requires a Socket.IO Redis adapter, a shared rate-limit store and
sticky sessions. Until then, keep the API on a single instance.

## 10. Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to
`main`: frontend tests, full ESLint, the production build, backend unit tests,
the syntax check, the integration suite against a disposable replica set,
dependency audits and a secret-exposure scan. It uses synthetic configuration
only — it never needs SMTP, Google or Cloudinary credentials, and it never
connects to a production database.
