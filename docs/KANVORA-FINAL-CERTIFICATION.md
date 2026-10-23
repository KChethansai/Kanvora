# Kanvora — Final Certification

**MODE:** BUILD, one baseline audit, one correction pass, one independent
review, one verification and release pass. No new feature phase was started.

**Verdict: PASS WITH DOCUMENTED MANUAL LIMITATIONS — KANVORA ENGINEERING
CLOSED.** One release-blocking defect was found, reproduced, fixed and pinned
by regression tests. Every mandatory gate is green. The checks that need
hardware, third-party services or tooling this environment does not have are
listed in §11 and are **not** claimed as passes.

---

## 1. Repository identity and final SHA

| Item | Value |
| --- | --- |
| Repository | `https://github.com/KChethansai/Kanvora` |
| Local path | `/home/chethan/Projects/Kanvora` |
| Certified baseline | `7f52ae4f438370f82438fbf14101b8accd76dbd8` (V5 release; local `main` = `origin/main` = GitHub `main`) |
| Correction commit | `8e8cd16` — `fix(realtime): admit a board join that races the board being left` |
| Branch | `feat/kanvora-final-certification` |
| Working tree at audit start | clean, no untracked files |
| Pass date | 2026-10-23 |

The merge commit cannot contain its own SHA. The post-merge `main` SHA, the
pull request and both CI runs are recorded in the pull request's release
comment. This document pins the tested implementation, not a predicted merge
SHA.

## 2. Phase history V1–V5

| Phase | Scope | Reproduced outcome |
| --- | --- | --- |
| V1 | Initial application and security hardening | Session cookies, origin/CSRF enforcement, role checks, upload validation, rate limits |
| V2 (UIX) | UI consistency, accessibility, design system | Released `a08046c`; 486-check geometry matrix (27 routes × 2 themes × 9 widths); 365 tests in 51 files; 98 removed `common.js` exports, 22 retired bridge tokens |
| V3 | Production reliability and stale-state corrections | Final implementation `4d9714f`; stale reads, board restoration and error surfaces hardened |
| V4 | Multi-user collaboration, concurrency, socket correctness | Tested `26e747f`; board sessions, revocation, optimistic rollback and socket authorization |
| V5 | Notification consistency, pagination, checklist validation, contract closure | Released `7f52ae4`; 9 findings audited (7 fixed, 1 harness miss, 1 `KEEP — VERIFIED`), 6 review corrections; 456 frontend tests in 65 files; 64 backend unit + 110 integration; route inventory 71/70 pinned by `Backend/tests/baseline.test.js` |

Nothing from V1–V5 was reverted, retired or re-implemented in this pass. The
V5 live harness was re-run unchanged and still passes **49/49** (§3).

## 3. Fresh validation results

Every number below was produced in this pass, in this environment, after the
correction was applied. Nothing is inherited from the V5 documents.

### 3.1 Mandatory gates

| Gate | Command | Result |
| --- | --- | --- |
| Frontend tests | `cd Frontend && npm run test` | **456 passed / 456**, 65 files |
| Frontend lint | `npm run lint` | **0 errors**, exit 0 |
| Frontend build | `VITE_API_URL=https://api.kanvora.example VITE_GOOGLE_CLIENT_ID= npm run build` | **built in 592 ms** |
| Backend unit | `cd Backend && npm test` | **64 passed / 64** |
| Backend integration | disposable `MongoMemoryReplSet` + `node --test tests/integration/*.test.js` | **112 passed / 112** (110 baseline + 2 new) |
| Backend syntax | `npm run check` | pass |
| Route inventory | `node scripts/routes.mjs` vs `docs/api-baseline.json` | **71 definitions / 70 API definitions**, canonical hash `aac8d3985def6a8187492490bd337d998b23d0e8c0a06a09bb6432ca38b8694a`, exact match |
| Secret scan | tracked files, key/credential patterns | **0 hits** |
| Dependency audit | `npm audit --omit=dev --audit-level=high` (both packages) | **0 vulnerabilities** |

The route inventory is unchanged from V5: no route was added, removed or
renamed, so no API contract changed.

### 3.2 Live application verification

A disposable certification harness drives the real stack: a real
`MongoMemoryReplSet`, the real backend with the real Socket.IO server, the real
Vite dev server, and isolated browser contexts with real cookie sessions. No
request is mocked; seeded rows are read back through the real API.

| Group | Checks | Result |
| --- | --- | --- |
| J1 authentication and session | 9 | pass |
| J2 workspace lifecycle | 5 | pass |
| J3 project lifecycle | 11 | pass |
| J4 board lists, cards, keyboard drag, peer deletion | 8 | pass |
| J5 templates, inbox, planner | 4 | pass |
| J6 search | 1 | pass |
| J7 profile and settings | 2 | pass |
| J8 notifications: counts, paging, live delivery, delete-under-held-read | 9 | pass |
| J9 collaboration, reconnect, permissions | 8 | pass |
| J10 responsive/theme matrix | 1 (108 combinations) | pass |
| J11 accessibility | 9 | pass |
| C console and network hygiene | 2 | pass |
| **Total** | **69** | **69 / 69** |

The harness was run five consecutive times after the fix, all green: three runs
at 68 checks, then two at 69 once the listener-growth check was added
(`J9.5a`). Before the fix the same harness failed a live-event check in 4 of 6
runs. The unchanged V5 harness (`live.mjs`, 49 checks covering notification
pagination, tombstones, checklist validation, board scoping and reconnect)
was re-run against this tree: **49/49**.

Representative assertions, quoted from the run:

- `J1.6 logout through the interface ends the session — http://localhost:5195/`
- `J1.7 a session with a stale version is rejected by the session probe — status 200 payload=null`
- `J1.8 a stale session cannot read protected data — status 401`
- `J1.9 the public shell renders in its own light scope — {"publicScope":{"theme":"dark","scope":"light"},"loginScope":{"scope":"light"}}`
- `J4.6 a keyboard drag can be started and cancelled without changing the board`
- `J8.8 a held read does not resurrect a deleted notification`
- `J8.9 the server really deleted the notification`
- `J9.5a reconnecting does not duplicate socket listeners — {"listenersBefore":2,"listenersAfter":{"cardCreated":2,"presence":1,"connect":2}}`
- `J9.6 a member cannot delete the workspace — status 403`
- `J9.7 a project in a workspace the account does not belong to is not readable — status 404`

### 3.3 One observed flake, disclosed

Five of six full integration runs were green. One run failed the pre-existing
test `handshakes reserve socket capacity before DB work and release rejected
and disconnected reservations`, which asserts a strict concurrent peak
(`peak === 4`) while Node runs test files in parallel. It passes in isolation
(twice) and in the three full runs that followed. It was **not** changed: loosening an
assertion to make a suite green is exactly the failure mode this pass is meant
to avoid. It is recorded in §11 as a known flake.

## 4. Confirmed defect fixed in this pass

### F-1 (P1) — live collaboration stopped after moving between boards

**Symptom.** In the certification harness, a card created by another user
sometimes never appeared in an already-open board, and a peer deletion
sometimes left the card on screen. The failing runs showed the browser had
received **no socket events at all** after the board loaded
(`events: []`), while the board itself rendered correctly from its HTTP reads.
No error was shown and nothing recovered until a full reconnect.

**Reproduction.** Deterministic at the socket layer. Two emits on one
authenticated socket: `join-project B` immediately followed by
`leave-project A`. The join for `B` returns `{ok:false}` and the server-side
room set contains only the socket id and the personal room — the socket is not
in `project:B`.

**Root cause.** `Backend/socket.js` kept a socket-wide `accessVersion`.
`leave-project` increments it; `join-project` captured it *before* awaiting
`authorized()`, and `authorized()` captures and compares it again after its own
database await. Any leave that lands during that window makes both checks
report "stale", and the handler returns `false` without joining and without
telling the client. Board-to-board navigation emits exactly that pair: the old
board's cleanup leaves while the new board's join is authorizing. The board
then renders from HTTP but is silently outside the room, so it receives no
`card-created`, `card-updated`, `card-deleted`, presence or activity events for
the rest of the session.

**Fix** (`Backend/socket.js`, `join-project` only). A bounded two-attempt loop:
retry once when authorization reported failure *and* the version moved during
the await; after a successful authorization require the version to still match.
Both attempts re-run `authorized()`, which re-reads the session version and
re-derives project access, so a revocation, role change, membership removal or
session bump is still enforced against current state rather than the captured
one. The retry is capped at two, charges the admission budgets exactly once
(before the loop), and re-checks the room cap immediately before joining.
No wire protocol, event name, payload or HTTP route changed.

**Tests**

| Test | Role |
| --- | --- |
| `a board join superseded by a concurrent leave still admits the socket` | Fails on the pre-fix code (verified: `{ok:false}`, room absent), passes after. Asserts server-side room membership, not client belief. |
| `a concurrent leave does not upgrade a denied board join` | Guard: a board the account cannot read stays denied even when the retry branch runs, and the denial is answered rather than timed out. |

**Before/after evidence**

| Measure | Before | After |
| --- | --- | --- |
| New socket integration test | fail (`must be in the board it navigated to`) | pass |
| Certification harness, live peer events | 4 of 6 runs failed a live-event check | 5 consecutive runs, 0 failures |
| Full integration suite | 111/111 (with 1 of the 2 new tests) | 112/112 |

No frontend change was needed: the client was already re-joining on mount, and
the server was discarding that join.

## 5. Security assessment

| Area | Result |
| --- | --- |
| Authorization and membership | Re-checked on every board join and on every retried join; a denied board cannot be reached by racing a leave (pinned by test) |
| Session revocation | `authorized()` re-reads `sessionVersion` on each attempt; a stale token is refused (`/auth/check-auth` → `payload: null`, protected reads → 401) |
| Account isolation | A project in a workspace the account does not belong to returns 404 to a non-member |
| Role restriction | A workspace member cannot delete the workspace (403) |
| CSRF / origin | Authenticated non-safe requests without a trusted `Origin` are refused (exercised by every write in the harness and by the backend suite) |
| Upload limits and file validation | Covered by the unchanged backend integration suite (media-security) |
| Pagination boundaries | Unchanged; `page`/`limit` validation still enforced |
| Error responses | Unchanged; no stack or internal identifier surfaced |
| Socket room authorization | Every join re-authorized; room cap re-checked after the await; presence bookkeeping updated in the same step as the room |
| Concurrency and stale responses | Board sessions, generation guards and tombstones from V3–V5 re-verified live |
| Optimistic rollback | Re-verified through the checklist and card flows |
| Secret exposure | 0 matches across 285 tracked files |
| Dependencies | 0 high/critical advisories in either package |

**Static analysis: NOT VERIFIED.** Neither Semgrep nor CodeQL is installed in
this environment, and installing one would have added tooling to a repository
that does not use it. No SAST result is claimed.

Independent adversarial review of the fix (security agent) found **no
authorization bypass** and confirmed the retry cannot outlive a revocation,
cannot unbounded-loop, cannot overshoot the room cap, and does not desynchronise
`roomPresence` from actual room membership. Its two remaining observations are
P2 and are recorded in §11.

## 6. Functional and multi-user assessment

Verified live against the real stack (69 checks, §3.2):

- Registration asks the visitor to verify their email; an unverified account is
  refused with 403; a verified credential trades for a session through the
  login form; logout ends the session; an anonymous visitor is redirected from
  a protected route.
- Workspace creation through the interface and through the API; deletion
  through the API; a deleted workspace is no longer readable.
- Project cards open the board; project rename and creation; project deletion
  removes readability; a project in a foreign workspace is not readable.
- Lists and cards are created and edited through the interface; the list footer
  control, the card title field, and the card editor are the real ones.
- Keyboard drag: the sortable handle is a focusable button with an accessible
  name and `aria-describedby`, Space starts a drag, Escape cancels it, and the
  board is unchanged afterwards.
- A peer card appears live; a card created while the other browser is
  disconnected is reconciled after reconnect; the board room is re-entered
  after reconnect; listener counts do not grow across the reconnect.
- Notification totals are account-wide (All 60, Unread 20) while the first page
  holds 50 rows; "Load older" appends the remaining page; a live invite raises
  the total from 60 to 61; a notification deleted while a stale read is in
  flight does not come back, and the server row is really gone.
- Templates, inbox, planner, profile, settings and search all render and
  respond without an error boundary.

## 7. Accessibility results

axe-core (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) was run against seven
authenticated routes plus an open dialog:

`/main-page`, `/main-page/notifications`, `/projects/:id`, `/templates`,
`/workspaces/settings/profile`, `/inbox`, `/planner`.

**0 violations of any impact** on all seven routes, and 0 serious/critical
violations on the open create-project dialog.

Targeted manual checks in the live browser:

- The card editor is a labelled `role="dialog"` (`aria-modal`, `aria-labelledby`)
  with focus inside it and 33 focusable descendants; Escape closes it.
- The create-project dialog is a labelled modal with a focus trap.
- Public pages keep `data-theme-scope="light"` while the stored preference is
  `dark`, so the marketing shell does not invert.
- Drag handles expose an accessible name and keyboard pickup.

**NOT VERIFIED:** native screen-reader output (VoiceOver/NVDA/JAWS), forced-colors
rendering, and native browser zoom. See §11 for the manual checklist.

## 8. Responsive and visual verification

The matrix is **108 combinations**: 9 widths (320, 360, 390, 430, 768, 1024,
1280, 1440, 1920) × 6 routes (`/`, `/login`, `/main-page`, the board,
notifications, templates) × 2 stored themes (dark, light).

For every combination the harness measured the document's horizontal overflow
and the bounding box of every interactive control, ignoring elements a
deliberate `overflow: hidden` ancestor or an `aria-hidden`/`inert` region
already removes from view. That exclusion matters: at 320 px the off-canvas
sidebar is translated outside the viewport, and a naive count reports its
links and buttons as clipped controls.

**Result: 0 overflow and 0 exposed clipped controls across all 108
combinations.** The stored theme is applied on authenticated routes and the
public shell stays in its light scope in both.

This is a reduced matrix, not the V4 486-check matrix: it covers six
representative routes at every target width and both themes rather than every
route in the application. The narrower scope is stated rather than implied.

## 9. Performance comparison

The frontend was not modified in this pass. To make the comparison reproducible
rather than asserted, a temporary worktree at the certified baseline
(`7f52ae4`) was built with the same command and the same environment, and every
built asset was compared by SHA-256:

| Measure | Baseline `7f52ae4` | Final | Delta |
| --- | --- | --- | --- |
| Hashed JS/CSS assets | 38 | 38 | 0 |
| Asset names and SHA-256 | — | — | **identical for every file** |
| Bundle size | 948,114 B raw / 276,813 B gzip (JS+CSS) | same | **0.00%** |

The change is backend-only in a Socket.IO event handler; no HTTP endpoint,
module boundary or render path was touched.

Live responsiveness and stability:

| Measure | Result |
| --- | --- |
| Board load to first seeded card | **357 ms** (dev server, cold route, disposable database) |
| Socket listeners across a forced reconnect | `card-created` 2 → 2, `presence-updated` 1, `connect` 2 → 2 |
| Duplicate deliveries observed | none; reconnect reconciles without duplicating cards |
| Endpoint latency | not re-measured — no HTTP route, controller or query changed in this pass |

No regression above 10% exists or has a mechanism to exist here.

## 10. Independent review

Two independent read-only reviews were run on the final diff.

| Review | Availability | Outcome |
| --- | --- | --- |
| Security / data integrity (`security` agent) | available | No P0/P1. Verified no authorization bypass, bounded retry, correct budget accounting, no room growth, presence and room membership mutated together, typing handler unaffected. Two P2 observations (§11). |
| Code and test quality (`code-reviewer` agent) | available | PASS on correctness: loop bounded, every path terminates, fail-closed, retry predicate correct, tests assert server-side room membership and create the race with back-to-back emits rather than sleeps. Two P2 + four P3. |
| `reviewer` agent | **unavailable** — its model could not be loaded | Not used. Reported rather than silently replaced. |

Findings actioned from the reviews (both concern the new tests and comments,
not the product):

- The denied-join guard could pass vacuously on an ack timeout; it now asserts
  the ack was answered, not merely that `ok` was false.
- The two comment blocks restated the same rationale; they are merged into one
  block that also states the bounded cost, matching the file's terse style.

Findings accepted without change (P2/P3, all recorded in §11): the residual
multi-leave race, the presence flap on a redundant re-join, the doubled
authorization cost under a deliberate join/leave flood, and the preference-level
notes (call-count assertions, comment length).

## 11. Known limitations and unavailable manual tests

**Never to be reported as passes in this project:**

- Native screen-reader output (VoiceOver, NVDA, JAWS). axe-core and DOM
  association were checked; a real screen reader was not run.
- Physical mobile hardware and touch gestures.
- Native browser zoom at 125%, 150% and 200%. The matrix resizes viewports; that
  is not the same thing and is not described as zoom.
- Forced-colors / high-contrast rendering.
- Real email delivery — SMTP is blank in the disposable environment, so the
  verification link was exercised through the backend integration suite's
  mailbox, not through a real inbox.
- Cloudinary attachment storage (credentials absent).
- INP and field Web Vitals.
- Semgrep and CodeQL — not installed; no SAST result is claimed.
- Notification volumes above `page <= 10000`.
- The full V4 486-check geometry matrix and the full V4 theme matrix; this pass
  ran a 108-combination reduced matrix (§8).
- Distinguishing "board deleted" from "role removed" — both fail closed with
  404 by design (V5 D-4).

**Known residual issues (P2, documented, not fixed in this pass):**

1. The access version is socket-wide, not per room. Two or more leaves landing
   inside a single join's authorization window can still abort that join. The
   realistic cause (one board's leave racing the next board's join) is fixed;
   the general case needs a per-room version map, which is an architectural
   change and out of scope here.
2. `authorized()` evicts the target room when the version moved, so a redundant
   re-join of a board the socket is already in can produce a leave/join
   presence flap. The retry immediately re-joins, so no events are lost beyond
   that window.
3. A client that deliberately alternates `join-project` and `leave-project` can
   force the retry, doubling authorization lookups within the same admission
   budget unit. Bounded at 2× and never a bypass.
4. One integration run in six failed a pre-existing timing-sensitive capacity
   test under parallel test-file execution (§3.3). The assertion was not
   loosened.

**Manual checklist for the owner** (five minutes, no tooling):

1. With the app open, turn on VoiceOver/NVDA and tab through a board: every
   list, card, drag handle and dialog control must be announced with a name.
2. Open a card and press Escape: focus must return to the card.
3. On a phone, drag a card between lists and pinch-zoom; nothing may overflow.
4. Set browser zoom to 200% on the board: the horizontal scroll must stay
   inside the board, not the page.
5. In OS high-contrast mode, confirm the focused control is still visible.

## 12. Deployment status

**Not deployed. No deployment was performed in this pass.** The release
procedure stopped at a merged `main` with green CI. `docs/DEPLOYMENT.md` remains
the deployment contract (Render backend, Vercel frontend, MongoDB replica set);
nothing in it changed.

## 13. CI results and pull request

- Pull request: `feat/kanvora-final-certification` → `main`.
- Required jobs: `Frontend (test, lint, build)`, `Backend (test, syntax)`,
  `Backend integration (MongoDB replica set)`, `Dependency audit
  (high/critical)`, `Secret exposure scan`.
- Merge method: normal merge, no force-push, no bypass.
- The exact merge SHA, both CI runs and the post-merge
  `local main = origin/main = GitHub main` comparison are recorded in the pull
  request's release comment.

## 14. Final project status

**Closed.** The application is certified against the gates in this document:
no unresolved P0/P1, all mandatory suites and builds green, no route or contract
change, no security regression, no new serious accessibility violation, no
horizontal overflow in the tested matrix, and no performance regression.

The improvement cycle ends here. Remaining non-critical work lives in §11 and in
`docs/KANVORA-MAINTENANCE-HANDOFF.md`; it is not a new phase.
