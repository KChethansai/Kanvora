# Kanvora — maintenance handoff

Everything an engineer needs to run, test, deploy and safely change Kanvora.
No secrets appear in this document.

- `Backend/` — Node 24 / Express 5 / Mongoose / Socket.IO API.
- `Frontend/` — React 19 / Vite / Tailwind SPA.
- `docs/` — phase reports, the API baseline and the deployment checklist.
- `docs/api-baseline.json` — the pinned route inventory. `Backend/tests/baseline.test.js`
  fails if the live inventory or its canonical hash drifts from this file.

Runtime floor: Node `24.x`, npm `>= 11` (`Backend/package.json` `engines`).

---

## 1. Install and run

### Backend

```bash
cd Backend
npm ci
npm start                  # node server.js
```

`config/env.js` loads `Backend/.env` through dotenv (without overriding values
already present in the environment). No example file ships with the backend, so
create `Backend/.env` yourself from §2. `Frontend/.env.example` does ship and
lists the two frontend variables.

Health checks: `GET /health` (liveness) and `GET /health/ready` (database).

`DB_URL` **must be a replica set** (Atlas, or a local single-node `rs0`).
Board, list, card, template and workspace mutations run in transactions; a
standalone `mongod` fails them with HTTP 500.

`TRUST_PROXY` must be an **integer** `0`–`10`. `TRUST_PROXY=false` stops the
server at start-up. Use `0` locally and `1` behind one reverse proxy.

### Frontend

```bash
cd Frontend
npm ci
VITE_API_URL=http://localhost:5000 npm run dev
```

`VITE_API_URL` is baked in at build time, so it must also be set for
`npm run build`. Leaving `VITE_GOOGLE_CLIENT_ID` blank hides the Google button
and makes the API answer 503 for that flow.

## 2. Environment variables

### Backend

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `production` in production. Anything else relaxes secure cookies, rate limits and error redaction and logs a warning. |
| `PORT` | Listen port. Defaults to `5000`. |
| `DB_URL` | MongoDB **replica set** connection string. |
| `SECRET_KEY` | Session signing key. Production requires ≥ 32 characters; changing it signs everyone out. |
| `CLIENT_URL` | Comma-separated exact browser origins. Drives CORS, the Socket.IO handshake and email links. |
| `TRUST_PROXY` | Integer `0`–`10`. |
| `COOKIE_SAME_SITE` | `none` for a cross-site frontend/backend split (requires HTTPS); `lax` otherwise. |
| `CSRF_REQUIRE_ORIGIN` | Defaults to `true`. Production enforces the origin regardless. |
| `SESSION_TTL_DAYS` | Session lifetime in days (default `7`). |
| `EMAIL_FROM` | From address for verification, reset and invitation mail. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Mail transport. Blank host disables delivery. |
| `GOOGLE_CLIENT_ID` | Google sign-in. Blank disables it. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Attachment storage. Blank disables uploads. |
| `GEMINI_API_KEY` | Enables the Kanvora Assistant's AI answers. Blank keeps the assistant in deterministic keyless help mode; no provider is called. |
| `GEMINI_MODEL` | Assistant model. Defaults to the stable `gemini-3.8-flash`; override per backend environment. Live availability is **NOT VERIFIED** without a key. |

`KANVORA_TEST_DB_URL` is test-only (§4).

### Frontend (build time)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin. Must describe the same deployment as the backend `CLIENT_URL`. |
| `VITE_GOOGLE_CLIENT_ID` | Must match the backend `GOOGLE_CLIENT_ID` when Google sign-in is offered. |

## 3. Tests

```bash
# Frontend — Vitest, jsdom, 73 files / 520 tests
cd Frontend && npm run test && npm run lint
VITE_API_URL=https://api.kanvora.example VITE_GOOGLE_CLIENT_ID= npm run build

# Backend — unit (no database, 67 tests) and syntax
cd Backend && npm test && npm run check

# Backend — integration (17 files / 160 tests, needs a local replica set, §4)
KANVORA_TEST_DB_URL='mongodb://127.0.0.1:27017/kanvora_test' npm run test:integration

# Route inventory drift check (71 total definitions / 70 API routes)
node scripts/routes.mjs
```

The assistant suites are part of those totals: `tests/integration/assistant.test.js`
(backend) and `assistant-panel`/`assistant-help` (frontend). The AI path is always
tested with an injected provider, so the suite never needs a Gemini key.

`Backend/tests/helpers/database.js` refuses any test URL that is not a local
host or whose database is not named `kanvora_test*`. That guard is deliberate:
the integration suite drops databases. Do not weaken it to point at a shared
server.

## 4. Local disposable MongoDB for integration tests

Use the same shape as CI (`.github/workflows/ci.yml`): a single-node replica
set named `rs0` on `127.0.0.1:27017`.

```bash
docker run --rm -d --name kanvora-mongo -p 127.0.0.1:27017:27017 \
  mongo:7.0 --replSet rs0 --bind_ip 127.0.0.1

docker exec kanvora-mongo mongosh --quiet --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'

cd Backend
KANVORA_TEST_DB_URL='mongodb://127.0.0.1:27017/kanvora_test' npm run test:integration

docker rm -f kanvora-mongo
```

Each test file creates its own `kanvora_test_<pid>_<uuid>` database and drops it
on teardown, so parallel runs do not collide. Tear the container down when you
are done; never point this at anything you want to keep.

## 5. Deployment configuration (do not run this from a working copy)

The contract lives in `docs/DEPLOYMENT.md`; this is the summary.

| Piece | Host | Build | Start |
| --- | --- | --- | --- |
| `Backend/` | Render web service | none | `npm start` |
| `Frontend/` | Vercel, **project root set to `Frontend/`** | `npm run build`, output `dist/` | static |

Setting the Vercel root to the repository root discards `Frontend/vercel.json`,
and every deep link then 404s on refresh.

Cross-site notes:

- `COOKIE_SAME_SITE=none` with HTTPS on both sides, or the browser drops the
  session cookie and every request after login returns 401.
- `CLIENT_URL` and `VITE_API_URL` must name the same deployment.
- `SECRET_KEY` is per environment; rotating it signs everyone out.
- A production deploy also needs a replica set `DB_URL`, an integer
  `TRUST_PROXY`, and `NODE_ENV=production`.

No deployment is part of a normal change request. Ship to `main`, let CI run,
and deploy separately through the provider.

## 6. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Every authenticated request returns 401 after login | `COOKIE_SAME_SITE` is `lax` on a cross-site deployment, or `CLIENT_URL` does not match the browser origin. |
| `403 Request origin required` on a write | The request carried the session cookie without a trusted `Origin`. Send the real origin, or fix `CLIENT_URL`. Never disable the check in production. |
| `TRUST_PROXY` start-up failure | It must be an integer, not `false`. |
| Mutations return 500 locally | `DB_URL` is a standalone `mongod`, so transactions are unsupported. Use a replica set. |
| Refresh on `/projects/:id` 404s in production | The Vercel project root is not `Frontend/`, so `vercel.json` rewrites are not applied. |
| Deep links work in dev and 404 in preview | Same cause; check the project root, not the SPA code. |
| Backend integration tests refuse to start | `KANVORA_TEST_DB_URL` is missing, is not localhost, or the database is not named `kanvora_test*`. |
| `baseline.test.js` fails after adding a route | Regenerate the inventory: `node scripts/routes.mjs` into `docs/api-baseline.json` (including the canonical hash) in the same change. |
| A board stops receiving live updates | Check `TRUST_PROXY`/`CLIENT_URL` first (the handshake is origin-checked), then the socket access-version path in `Backend/socket.js` and §9 below. |
| Login succeeds but the app still shows the marketing shell | Public routes always render `data-theme-scope="light"`; authenticated routes are `/main-page`, `/workspaces`, `/templates`, `/projects`, `/inbox`, `/planner`. An authenticated visit to `/` is redirected to `/main-page`. |

## 7. Known product limitations

These are accepted product decisions, not defects:

- Live board activity (for example "Ana moved a card") is not shown. The
  `activity-created` event is emitted but the board deliberately ignores events
  that do not belong to the open board. Deferred as V5 D-1.
- Access loss does not name its cause: a deleted board and a removed role both
  return 404, by design.
- Notification pagination is offset-based. A delete between pages can make the
  offset window approximate, and the UI labels the shifted window instead of
  claiming an exact range. Cursor pagination is deferred (V5 D-5).
- Checklist titles are validated array-wide on submit; per-item debounced
  validation is deliberately not implemented.
- Notification volumes above `page <= 10000` are not supported.
- Attachments require Cloudinary credentials; without them the feature is off.
- The Kanvora Assistant is **read-only**. It answers questions and links routes; it
  cannot create, edit, delete, invite or move anything.
- Without `GEMINI_API_KEY` the assistant answers from built-in curated help only. The
  panel labels both modes (`Help mode` / `AI · <model>`), and an AI failure falls back
  to curated help rather than pretending to be an answer.
- Live Gemini and live Cloudinary are not exercised by CI. Both adapters are tested
  through injected providers; see §10.

## 8. Rules for changing this codebase safely

The guards below exist because an earlier phase was burned by their absence.
Breaking one is usually a silent regression, not a failing test.

1. **Contracts are pinned, not documented.** `Backend/tests/baseline.test.js`
   compares the live route inventory to `docs/api-baseline.json` including the
   canonical hash. A new endpoint is a deliberate change: regenerate the file in
   the same commit. Do not delete the assertion.
2. **Sessions are database-checked.** Every request re-reads the user's
   `sessionVersion`; `requireSession`/`verifyRolesToken` reject a mismatch. Do
   not "optimise" that into a token-only check.
3. **Board joins are authorized per join, and the access version is a
   revocation signal.** `join-project` re-runs `authorized()` on every retry. If
   you touch that handler, keep the retry bounded, keep the room cap re-check
   after the await, and keep presence bookkeeping in the same step as
   `socket.join`. Known residual: the access version is socket-wide, so a
   per-room map is the correct long-term fix (see §9).
4. **Board session identity.** Asynchronous board reads are tagged with a board
   session, and late responses from a previous board are dropped. Do not remove
   `beginBoardSession`/`isBoardSessionCurrent` guards — that is what prevents a
   stale board from repainting the current one.
5. **Generation guards and tombstones.** Deletions are recorded as tombstones
   for the session and are cleared only by `reset()`. An in-flight read must not
   resurrect a deleted row. Do not add TTL eviction or clear the maps on
   account switch without a never-reset counter; both were rejected with
   reasons in `docs/KANVORA-V5-CONTRACT-DECISIONS.md`.
6. **Optimistic writes roll back.** A refused mutation restores the previous
   state; a refused delete restores the row. Keep the rollback with the write.
7. **Theme scope is route-driven.** `Frontend/src/config/themeScope.js` is the
   single source of truth, mirrored by the boot script in `index.html`. Public
   pages stay light whatever the stored preference; authenticated pages follow
   it. `theme-scope.test.js` asserts the two lists never drift.
8. **Pagination labels must stay honest.** Offset paging plus deletes makes a
   window approximate; the UI must say so rather than print a number it cannot
   prove.
9. **Accessibility regressions are gated.** Dialogs use `useDialogFocus`
   (`role="dialog"`, `aria-modal`, labelled, trapped, Escape closes). Keyboard
   drag is wired through `KeyboardSensor` with `sortableKeyboardCoordinates`.
   Interactive controls must keep an accessible name.
10. **No silent dependency or contract changes.** No runtime dependency has
    been added since V5. A new dependency needs a written justification against
    what the platform already provides.
11. **Two `$or` predicates are never combined by spreading.** The visibility filter
    and a keyset predicate are both `$or`; spreading one over the other silently drops
    authorization on every page after the first. Compose paginated filters with
    `$and` and keep a test that pages past the first page.
12. **Provider boundaries are injected.** Attachment storage goes through
    `Backend/utils/mediaStore.js` (`setMediaStore`/`resetMediaStore`) and the assistant
    through the `assistantProvider` argument of `createApp`. Tests must never require
    live credentials, and the keyless assistant path must never call the provider.
13. **The assistant is read-only.** It has no write route and the client sends no
    system instruction. If write actions are ever added, re-run the authorization,
    prompt-injection and rate-limit tests before shipping.
14. **Authentication and Registration.** Normal registration (`POST /auth/register`)
    activates immediately (`emailVerified: true`), issues a session cookie, and
    logs the user in without requiring an email verification step or SMTP
    availability. `POST /auth/verify-email` and `POST /auth/resend-verification` are
    retired. Legacy unverified accounts (`emailVerified: false`) return HTTP 403 on
    login and are claimed via password reset (`POST /auth/forgot-password` /
    `POST /auth/reset-password`). Single-use workspace invitations prove email
    ownership and activate unverified legacy accounts upon acceptance. Google OAuth
    (`POST /oauth/google`) refuses silent linking to unlinked password accounts (HTTP 409)
    to prevent cross-protocol account takeover.

## 9. Where the remaining work is

`docs/KANVORA-FINAL-REMEDIATION-REPORT.md` records the prior V6 pass. The targeted
eight-finding follow-up is documented in `docs/KANVORA-EIGHT-FINDING-REMEDIATION.md`;
its implementation, verification, and four-perspective review are complete.

`docs/KANVORA-FINAL-CERTIFICATION.md` §11 lists the checks that need hardware,
third-party services or tooling this environment does not have (native screen
readers, physical devices, native zoom, forced colors, real email, Cloudinary,
field Web Vitals, Semgrep/CodeQL) together with a five-minute manual checklist.

It also lists the four residual P2 items from the final review. The first —
making the socket access version per room instead of socket-wide — is the only
one with a real design decision behind it, and it is not required for the
application to be correct on the paths users take.

## 10. Kanvora Assistant

A read-only product-help panel on every authenticated page.

| Piece | File |
| --- | --- |
| Routes | `Backend/APIs/assistantAPI.js` — `GET /api/assistant/status`, `POST /api/assistant/chat` |
| Validation, limits, error mapping | `Backend/controllers/assistantController.js` |
| Model adapter | `Backend/services/geminiProvider.js` |
| Bounded project context | `Backend/services/projectContext.js` |
| Keyless curated content | `Backend/content/assistantHelp.js` |
| Panel + local help | `Frontend/src/components/Assistant.jsx`, `Frontend/src/utils/assistantHelp.js` |
| Mount point | `Frontend/src/components/ProtectedRoute.jsx` |

Limits: 1000-character message, 10 history turns (user turn 1000, assistant turn
4000), 8000 characters of conversation, 600 output tokens, 15-second provider
timeout, 20 requests/minute per account, one in-flight request per account and four
globally.

Project context is opt-in per request, bounded to 10 lists / 50 card titles / 6000
characters, strips markup and control characters, never includes comments,
attachments or email addresses, and is re-authorized with `findProject(..., 'read')`.
It is sent as a separate user-content turn, not concatenated into the server-authored
system instruction; the provider adapter labels it as untrusted project data.

To change the keyless answers, edit `Backend/content/assistantHelp.js` and the
frontend `assistantHelp.js` keyword table together; the backend suite asserts the
curated shape and the frontend suite asserts routing. To add a model, implement the
same `{ model, reply() }` shape and pass it as `assistantProvider` to `createApp`.

Live Gemini and live Cloudinary remain **NOT VERIFIED** in this environment. See
`docs/KANVORA-FINAL-REMEDIATION-REPORT.md` §C.5 and §F.
