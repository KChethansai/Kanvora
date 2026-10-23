# Kanvora — final remediation report

- **Base commit:** `31ecdf9fbd21a3bad9e99f903e357c86f3c68cb7` (`main`)
- **Branch:** `fix/kanvora-final-remediation`
- **Mode:** one-shot build; no redesign, no framework migration, no speculative cleanup
- **Scope:** the ten source-grounded findings (`F-01`…`F-10`) plus the missing Kanvora
  Assistant and the regression, security, accessibility, responsive and performance
  gates that protect them
- **Verdict:** `PASS WITH DOCUMENTED EXTERNAL LIMITATIONS — KANVORA FINAL REMEDIATION VERIFIED`

Nothing in this document is a projected result. Every number below comes from a run
recorded in this change: the command, the suite and the observed count.

---

## A. What changed and why

The application was already certified through V5. This pass fixed ten defects that
survived that certification, and added the assistant the product had been missing.
The constraints were explicit and are intact:

- the V1–V5 fixes, the permission model, the socket contracts and the visual language
  are unchanged;
- no tests were weakened, skipped or deleted to reach green — two hard-coded route
  counts were *raised* to include the new authenticated routes, and the strict
  per-route assertions around them were left in place;
- every behaviour change has a regression test that was observed failing against the
  base commit before the fix (section D.2);
- no credential was invented. The assistant runs in a deterministic keyless mode when
  no Gemini key is configured, and the model adapter is exercised with an injected
  provider.

### A.1 Files and seams worth knowing

| Area | Where |
| --- | --- |
| Logout truthfulness | `Frontend/src/store/authStore.js`, `Frontend/src/components/Navbar.jsx` |
| Notification write consistency | `Frontend/src/store/notificationStore.js`, `Frontend/src/components/Notifications.jsx` |
| Template discovery paging + search | `Backend/controllers/templeteContoler.js`, `Frontend/src/components/Templates.jsx`, `Frontend/src/components/Navbar.jsx` |
| Comment notification audience | `Backend/controllers/commentController.js` |
| Attachment lifecycle + deletion cascade | `Backend/utils/mediaStore.js`, `Backend/APIs/ProjectsAPI.js` |
| Assistant backend | `Backend/APIs/assistantAPI.js`, `Backend/controllers/assistantController.js`, `Backend/services/geminiProvider.js`, `Backend/services/projectContext.js`, `Backend/content/assistantHelp.js` |
| Assistant frontend | `Frontend/src/components/Assistant.jsx`, `Frontend/src/utils/assistantHelp.js`, `Frontend/src/components/ProtectedRoute.jsx` |
| Route inventory | `Backend/tests/baseline.test.js`, `docs/api-baseline.json` |

The route inventory moved from **71 definitions / 70 API definitions** to
**73 / 72**: the assistant exposes `GET /api/assistant/status` and
`POST /api/assistant/chat`. The canonical inventory hash is
`0176e5d51cc1b2e2cf51616fe023a127fd4f38bfeae71c14371031b72438cb77` and the
baseline records `phase: "V6"`, `baselineCommit: "31ecdf9…"`.

---

## B. Findings

| ID | Severity | Finding | Fix | Regression proof |
| --- | --- | --- | --- | --- |
| F-01 | High | The UI cleared the account and reported success even when the server never revoked the session. | Logout confirms revocation first; a refusal keeps the account and says so. Concurrent attempts are refused locally. | `auth-session.test.js`, `account-epoch.test.js`, `navbar-logout.test.jsx` |
| F-02 | High | Read/read-all failures were swallowed, leaving the badge and rows in a state the server rejected. | Epoch-guarded optimistic writes, reconciliation refetch, owned-row restore, visible `writeError`. | `notification-write-consistency.test.js` |
| F-03 | Medium | A read-only export appended to the project's audit history. | The write was removed; no consumer ever read that array. | `project-security.test.js` |
| F-04 | High | Comment notifications were addressed from stale membership, so removed or unauthorized accounts could be notified. | Audience recomputed from current authority; mentions intersected with the audience; per-recipient access re-check. | `comment-notifications.test.js` |
| F-05 | High | Template discovery returned the whole catalogue in one response and searched only that response. | Two-stream keyset pagination with a deterministic cursor, batched workspace preload, page-scoped favourites, server-side search, load-more, by-id deep links. | `template-discovery-pagination.test.js`, `template-pagination.test.jsx`, `navbar-template-search.test.jsx` |
| F-06 | High | An upload could commit after the uploader lost access, and a failed metadata write left the asset behind. | Injectable provider seam, post-upload re-authorization, exact-publicId cleanup, post-commit cleanup. | `card-attachment-lifecycle.test.js` |
| F-07 | Medium | Notification rows were one large interactive control, so reading and deleting were not separable and focus was lost. | Semantic `<article>` rows, separate named actions, focus target, `role="alert"` error banner. | `notification-accessibility.test.jsx` |
| F-08 | Low | A persisted status label looked up the wrong key and lost its styling. | `'IN PROGRESS'` → `'IN-PROGRESS'`. | `settings-status-labels.test.jsx` |
| F-09 | Low | A camera button offered a change that does not exist. | Removed the dead control and its import. | `profile-and-controls-accessibility.test.jsx` |
| F-10 | High | Deleting a list or card left comments and attachments behind. | Cascades run inside the transaction; socket events and asset cleanup only after commit. | `card-attachment-lifecycle.test.js` |

### B.1 F-01 — a logout that did not happen

`logout()` posted to the server and then cleared local identity regardless of the
answer. A refused request (expired cookie, proxy error, origin rejection) produced the
same screen as a real sign-out while the HttpOnly cookie stayed valid — the next
request was still authenticated.

The store now:

1. refuses a second concurrent revocation (`signingOut`, `{ ok: false, reason:
   'in-flight' }`);
2. treats **401 only** as "already signed out" — a 403 is *not* confirmation, because
   the origin guard answers 403 before the route runs and the session may be intact;
3. on success calls `resetAccountData()` and then clears identity, returning
   `{ ok: true }`;
4. on failure keeps the account, exposes `logoutError` and returns
   `{ ok: false, reason: 'unconfirmed' }`;
5. clears `signingOut` on every superseded path, and `setUser`/`login` reset it so a
   later identity is never locked out by an earlier attempt.

The navbar toasts only on `ok: true`. `account-epoch.test.js` was rewritten to the new
contract: a superseded attempt clears the guard, an unconfirmed attempt preserves data.

### B.2 F-02 — reads that lied

`markRead`/`markAllRead` updated the row and the badge, sent the request and ignored a
failure. The UI then showed a read state the server had refused.

The store now captures the account epoch, resolves the optimistic override only when
the response belongs to the current account, refetches to reconcile an ambiguous
timeout, restores the exact owned rows (including their unread flags and the mark-all
snapshot), and records a visible `writeError` that clears on success or `reset()`.
`deleteNotif` follows the same rules: epoch capture, rollback on refusal, and a
reported error instead of a silent pop-out-and-back.

### B.3 F-03 — an audit write on a read path

`GET /projects/:id/export` pushed an entry onto `auditLogs`. Nothing in the codebase
reads that array, so the only effect was an unbounded write caused by a GET. The push
was deleted; the route count is unchanged.

### B.4 F-04 — notifying the wrong people

Comment notifications were built from the comment author's view of the project rather
than from current authority. The audience is now assembled from the project creator,
current members, direct grants and the workspace owner/members; mentions are resolved
only inside that audience; duplicates are removed; and each recipient is re-checked
with `findProject()` before the notification is written. The route lives at
`/api/comment`.

### B.5 F-05 — a catalogue that could not page

`getTemplates` read every template and every project, resolved workspace access per
row, then returned the result. Pagination, search and deep links were impossible
without loading everything.

Discovery now merges two keyset-paged streams:

- scope `templates-discovery` + viewer, keys `[createdAtMs, idHex]`, deterministic
  `{ createdAt: -1, _id: -1 }`;
- default 24, maximum 50, `page: { limit, hasMore, nextCursor }`;
- workspace context preloaded for the page and favourites resolved with one query;
- an invalid cursor or limit is a 400 (the shared `fail()` now honours
  `error.status === 400` for this controller);
- the authorization predicate and the keyset predicate are combined with `$and`, not
  by spreading two `$or` fragments — see section D.6, where the review caught the
  spread overwriting the visibility filter on page ≥ 2.

Search (`?search=`) is server-side, literal (user input is escaped, length ≤ 80) and
subject to the same visibility predicate, so the navbar no longer searches only the
first page. The frontend appends cursor pages with de-duplication and renders
`Load more` outside the empty-state ternary.

### B.6 F-06 — assets that outlived their authority

The upload handler trusted the authorization check that ran before the file was
written. If the uploader lost access during the upload, the asset committed anyway; if
the metadata append failed, the asset was orphaned.

`Backend/utils/mediaStore.js` is now the provider seam
(`setMediaStore`/`resetMediaStore`/`uploadImageFile`/`deletePrivateAsset`/
`deletePrivateAssets`, authenticated delivery, idempotent destroy, sanitized logging).
The handler re-authorizes after the upload, deletes the exact `publicId` when access
was revoked or the append returned nothing, and reconciles an ambiguous append:

- the card demonstrably references the asset → keep it and continue;
- the card demonstrably does not → delete it and surface the error;
- the outcome cannot be read → **keep the file** and log it for reconciliation.
  Deleting committed user data is worse than an orphan that can be swept later.

Card and list deletion clean their attachments only after the transaction commits.

### B.7 F-07 — a row that was one big button

The notification row was a single interactive element, so “open”, “mark read” and
“delete” shared one target and one focus stop. The row is now a non-interactive
`<article data-notification-id>` with explicit `Mark as read`, `Delete`, `Accept` and
`Decline` actions; the list container is focusable and receives focus after a row is
removed; the write error banner is `role="alert"`.

### B.8 F-08 — a collapsed status chip

`statusMeta` looked up `'IN PROGRESS'` while the persisted value is `'IN-PROGRESS'`.
The chip lost its label and token styling. The key was corrected; the test renders
every persisted status.

### B.9 F-09 — a control for a feature that does not exist

The profile page rendered a “Change avatar” camera button with no handler. It and its
`BsCamera` import were removed.

### B.10 F-10 — deletions that left their children

Deleting a list deleted the list row and left its cards, comments and attachments;
deleting a card left its comments. Both now run inside the transaction:

- list deletion reads the card ids and attachment publicIds first, deletes the
  comments for those ids, then the cards, then the list;
- card deletion deletes its comments;
- socket events are emitted only after commit;
- Cloudinary cleanup runs after commit and cannot turn a committed delete into an
  error.

A foreign project's cards are never touched: the cascade is scoped to the cards that
belong to the deleted list.

---

## C. Kanvora Assistant

### C.1 What it is

A launcher on every authenticated page opens a panel that answers product questions.
It is deliberately **read-only**: it cannot create, edit, delete, invite or move
anything.

It has two modes:

- **Keyless (default).** Deterministic curated help runs entirely in the client. No
  network request leaves the page, and no model is called. Eight topics with steps and
  route links, article keyword/title scoring with a threshold, greeting and
  capability intents, and suggested questions for an empty conversation.
- **AI (configured).** The backend calls Gemini server-side when `GEMINI_API_KEY` is
  set. The client asks the backend, never the provider.

The mode is visible in the panel: `Help mode` or `AI · <model>`. An AI failure falls
back to curated help and says so; it is never presented as an AI answer.

### C.2 Backend

| Endpoint | Auth | Limit |
| --- | --- | --- |
| `GET /api/assistant/status` | authenticated | — |
| `POST /api/assistant/chat` | authenticated | 20 requests/minute per account |

Request validation:

- only `message`, `history`, `projectId`, `includeProjectContext` are accepted;
- message ≤ 1000 characters; history ≤ 10 turns; a user turn ≤ 1000; an assistant turn
  ≤ 4000; the whole conversation ≤ 8000;
- `projectId` must be an object id; `includeProjectContext` must be a boolean;
- any malformed field is a 400 with **zero provider calls**.

Provider (`Backend/services/geminiProvider.js`):

- official `@google/genai`, server-side only;
- `abortSignal: AbortSignal.timeout(15000)` and `httpOptions.timeout`;
- 600 output tokens maximum;
- returns `null` when no key is configured — the controller then answers from the
  curated content and flags the mode honestly.

Project context (`Backend/services/projectContext.js`) is opt-in per request:

- bounded to 10 lists, 50 card titles, 6000 characters;
- titles are stripped of markup and control characters;
- **no** comments, attachments or email addresses;
- authorization is re-checked with `findProject(..., 'read')`; a stranger gets 404;
- the block is wrapped in `<project_data>` and the server-authored system instruction
  declares it untrusted data, not instructions.

Error mapping: provider 429 → 429, timeout → 504, anything else → 502. Provider text is
never echoed to the client. Concurrency: one in-flight request per account, four
globally; a second concurrent request is refused with 429.

The server composes the system instruction itself. The client cannot supply one, and
the route allowlist is fixed server-side.

### C.3 Frontend

`Frontend/src/components/Assistant.jsx` is mounted once in `ProtectedRoute`:

- a labelled launcher that opens and closes the panel and restores focus on close;
- `role="dialog"`, `aria-modal`, `useDialogFocus`, Escape closes;
- the launcher sits above the mobile quick-actions control (`bottom-20` on small
  screens) and owns the corner on desktop, so it never covers a persistent control;
- 1000-character input, 40 retained messages, 10 history turns, duplicate-send guard;
- a `sr-only` `aria-live` region for replies;
- opt-in project-context selector plus a Gemini disclosure;
- no conversation is persisted to storage;
- clearing or switching accounts retires the conversation generation, so a late answer
  cannot repopulate an empty panel;
- history sent to the server is shortened per turn and trimmed to a 7000-character
  budget, so a long answer cannot make the next turn invalid.

No provider SDK reaches the browser bundle: a scan of `dist/` for `@google/genai`,
`GEMINI_API_KEY` and `generativelanguage` returns zero hits.

### C.4 Verification

| Check | Result |
| --- | --- |
| Backend assistant suite | 17/17 |
| Frontend panel + help suites | 15 + 6 |
| Keyless answer with zero provider calls | browser check `J12.3` |
| Curated help needs no network | asserted — 0 chat POSTs, 0 provider requests |
| Malformed input rejected before the provider | 11 cases, 0 calls |
| Prompt injection stays data | asserted in the backend suite |
| Stranger / revoked project context | 404 |
| Rate limit | 21st request in a minute → 429 |
| Concurrent request | 429 |
| Provider failures | 4 mapped, no text echoed |
| Anonymous access | 401 |
| Panel axe scan | 0 serious/critical |
| Launcher overlap (320/390/768/1280) | clean |
| Panel layout (320/390/768/1280/1920) | inside the viewport, input reachable |

### C.5 Not verified

- **Live Gemini.** No key is available in this environment. The adapter is exercised
  with an injected provider only. Model availability for the default
  `gemini-3.5-flash` (fallback `gemini-2.5-flash`) is **NOT VERIFIED** live.
- **Live Cloudinary.** No credentials. The media lifecycle is tested through the
  injected store; real delivery and destroy calls are **NOT VERIFIED** live.

To enable AI in an environment: set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`)
on the backend. The frontend needs no change.

---

## D. Verification evidence

### D.1 Test totals (final run on this tree)

| Gate | Command | Result |
| --- | --- | --- |
| Backend syntax | `npm run check` | pass |
| Backend unit | `npm test` | **64/64** |
| Backend integration (17 files) | `node /…/integration.mjs` (disposable replica set) | **159/159** |
| Frontend unit (73 files) | `npx vitest run` | **513/513** |
| Frontend lint | `npx eslint .` | **0 problems** |
| Frontend build | `vite build` (synthetic production API origin) | **green** |
| Route inventory | `node scripts/routes.mjs` vs baseline | **73 / 72, hash match** |
| Dependency audit | `npm audit --omit=dev` (both packages) | **0 vulnerabilities** |
| Secret scan | `bash .github/scripts/secret-scan.sh` | **0 findings** |
| Browser certification | `certify.mjs` | **79/79 checks** |

### D.2 RED proofs

The pre-fix tree was checked out into a disposable worktree at the base commit and the
new tests were run against it. The runner's hard-coded working directory was corrected
first; before that correction, the “RED” run silently executed the fixed tree.

| Suite | On the base commit | On this tree |
| --- | --- | --- |
| `comment-notifications.test.js` (F-04) | **0/3** | 3/3 |
| `template-discovery-pagination.test.js` (F-05) | **0/7** | 10/10 |
| `card-attachment-lifecycle.test.js` (F-06/F-10) | **0/14** | 15/15 |
| Frontend `auth-session` + `notification-write-consistency` + `settings-status-labels` | **10 failed / 9 passed** | all pass |

Two authorization proofs were run separately because they were found by the review:

- a foreign account's unpublished template appeared on cursor page ≥ 2 → the new test
  failed before the `$and` fix and passes after it;
- a 403 logout was reported as success → the new test failed before the fix and passes
  after it.

The 9 frontend tests that passed on the base commit assert behaviour that did not
change (credential exchange, recovery tokens, non-status rendering). They are not
counted as proof.

### D.3 Browser certification

`~/…/kanvora-final/certify.mjs` starts a disposable replica set, the backend and the
Vite dev server against seeded data, then drives two browser contexts.

- **79/79 checks pass**, including the pre-existing 69 and ten assistant checks.
- Responsive matrix: **108 combinations** (six widths × light/dark × several routes) —
  no horizontal overflow, no exposed clipped control.
- Assistant panel: 320/390/768/1280/1920 px, inside the viewport, input reachable.
- Launcher: inside the viewport at 320/390/768/1280 and never covering a persistent
  control.
- axe: **0 serious/critical** on the audited pages and on the open assistant panel.
- Two-user collaboration: a member creates cards, the peer sees them live; a card
  created while the peer is disconnected is reconciled after reconnect; the board room
  is re-entered; **listener counts do not grow**; a member cannot delete the workspace;
  a foreign workspace board is 404.
- Console and network hygiene: no unexpected console errors, no failed requests.
- Keyless assistant: a curated question is answered with **zero** chat POSTs and
  **zero** provider requests.

### D.4 Socket residuals

The socket suite was run three consecutive times: **14/14 each run**. It covers
repeated joins with bounded authorization work, unchanged presence not being
rebroadcast, concurrent joins, capacity reservations before database work, handshake
rate budgets, revocation hooks, room caps, and join/leave races. The previously flaky
capacity test passed all three runs.

### D.5 Performance

Same seeded database, both backends started side by side (base commit on one port, this
tree on the other), identical token and origin, 40 interleaved requests per endpoint
with the first five discarded as warm-up. p50 in milliseconds.

| Endpoint | Before | After | Δ p50 | Payload |
| --- | --- | --- | --- | --- |
| Project list (24) | 58.3 | 52.8 | **−9.4%** | unchanged |
| Board detail | 16.1 | 16.0 | **−0.6%** | unchanged |
| Board lists + cards | 10.1 | 9.5 | **−5.9%** | unchanged |
| Notifications (50) | 10.7 | 10.4 | **−2.8%** | unchanged |
| Templates discovery | 119.2 | 21.7 | **−81.8%** | 182,046 → 12,457 B (−93.2%) |
| Workspace cards | 18.1 | 18.5 | **+2.2%** | unchanged |

The blocking rule is a regression above 10% on a comparable workload. The largest
regression is **+2.2%**, inside run-to-run noise and far below the threshold.
Templates improve by 81.8% because the first page is now bounded to 24 rows instead of
the whole catalogue.

### D.6 Security

| Check | Result |
| --- | --- |
| Every private HTTP definition rejects an anonymous request | **61/61** |
| Assistant anonymous access | 401 |
| Assistant stranger/revoked project context | 404 |
| Prompt injection inside `<project_data>` | treated as data |
| Provider errors echoed to the client | none |
| Gemini key in the browser bundle | none |
| `npm audit --omit=dev` | 0 vulnerabilities (both packages) |
| Repository secret scan | 0 findings |
| `.env` files tracked | only `Frontend/.env.example` |
| Authorization predicate preserved across cursor pages | regression test |

**Not run:** Semgrep and CodeQL are not installed in this environment. Those gates are
**NOT VERIFIED** and are listed in section F. The secret scan and dependency audit did
run.

### D.7 Adversarial review

One independent review was requested. The first reviewer session failed because its
configured model was unavailable; the retry with a second reviewer completed. It
reported one critical, two high, four medium and one low finding. All were reproduced,
fixed and covered, except the load-more race, which is guarded in code without a
standalone UI race test.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Critical | Spreading the keyset `$or` over the visibility `$or` dropped the authorization predicate on every page after the first; other accounts' unpublished templates were reachable. | `$and` composition in both streams + regression test (RED before the fix). |
| 2 | High | A 403 from the origin guard was treated as a confirmed sign-out. | Only 401 is confirmation; 403 keeps the account and reports an actionable error + test. |
| 3 | High | The history limit (1000) was smaller than the reply limit (4000), so a long answer made the next turn invalid. | Role-specific server limits + client per-turn shortening and a 7000-character budget + tests on both sides. |
| 4 | Medium | Clearing the conversation while an answer was in flight let the late answer repopulate the panel. | Conversation generation guard + test. |
| 5 | Medium | A deep link to a template outside page 1 did nothing, and the navbar's template search only saw page 1. | By-id fetch for the deep link, server-side search for the navbar + tests. |
| 6 | Medium | A cursor page still in flight could advance the cursor after a reset, skipping a row. | Request generation guard; no standalone UI race test (documented). |
| 7 | Medium | A failed notification delete restored the row silently and had no epoch guard. | Visible `writeError`, epoch capture + tests. |
| 8 | Low | An ambiguous append error destroyed an asset the card had already committed. | Tri-state reconciliation; the asset is kept when the outcome cannot be proven + test. |

The review also checked for weakened tests and unfalsifiable assertions. Two hard-coded
counts had to move because the assistant adds two authenticated routes; they were
raised from 59 to 61 and from 71/70 to 73/72, and the per-route assertions stayed
strict. No assertion was relaxed to match the implementation.

---

## E. Release

- **Branch:** `fix/kanvora-final-remediation`, created from
  `31ecdf9fbd21a3bad9e99f903e357c86f3c68cb7`. Local `main`, `origin/main` and GitHub
  `main` pointed at the same commit before the branch was cut; nothing newer was
  waiting to be reconciled.
- **Commit groups:** backend fixes and tests; assistant backend; frontend fixes;
  assistant frontend; documentation and route baseline. Each group is independently
  reviewable and the full gate set was run on the final tree, not per group.
- **Release path:** push the branch, open a pull request to `main`, wait for the CI
  workflow (frontend test/lint/build, backend unit, backend integration, route
  baseline, secret scan), then merge normally. No force-push, no reset, no history
  rewrite, no production deploy. A Vercel preview is a preview, not a deploy.
- **Rollback:** revert the merge commit. The change adds no migration, no destructive
  schema edit and no required environment variable; removing the assistant routes and
  the `@google/genai` dependency returns the backend to its previous shape.
- The authoritative CI run, pull request and merge commit are recorded on the pull
  request that carries this document.

---

## F. Limitations and residual risk

### F.1 External limitations (not defects in this change)

1. **Live Gemini is NOT VERIFIED.** No key is available. All AI-path tests use an
   injected provider. Model availability for `gemini-3.5-flash` and the `gemini-2.5-flash`
   fallback must be confirmed in an environment with a key.
2. **Live Cloudinary is NOT VERIFIED.** No credentials. The upload/destroy lifecycle is
   tested through the provider seam; real delivery, transformations and destroy calls
   are not exercised.
3. **Semgrep and CodeQL did not run** (not installed). The secret scan, dependency
   audit, route-authentication check and the manual adversarial review did run.
4. **Native assistive technology and real devices were not used.** Accessibility is
   covered by semantic assertions, axe (0 serious/critical), keyboard focus tests and
   the responsive matrix, not by a screen reader or a physical phone.
5. **Field Web Vitals were not measured.** Performance evidence is server-side latency
   on a seeded dataset plus the build output, not real-user monitoring.

### F.2 Accepted residual risks

- The load-more race is fixed by a request generation guard but has no standalone UI
  race test. A future change to the cursor flow should add one.
- Assistant answers are read-only; the product may later want write actions. That is a
  new feature, not a defect, and it must keep the same authorization and prompt
  boundaries.
- The socket access version remains socket-wide rather than per-room (documented since
  V5). This change does not touch it.
- A cursor page is bounded to 50 rows and discovery to the two source collections; a
  future third source must join the merge rather than bypass it.

### F.3 Verdict

```
PASS WITH DOCUMENTED EXTERNAL LIMITATIONS — KANVORA FINAL REMEDIATION VERIFIED
```
