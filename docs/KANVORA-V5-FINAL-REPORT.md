# Kanvora V5 — Final Report

| | |
|---|---|
| Original baseline | `87df5956bfb2ec24e15ea67e37a30475cfac4a1f` |
| Branch | `feat/kanvora-v5-contract-closure` |
| Pull request | [#4](https://github.com/KChethansai/Kanvora/pull/4) |
| Release SHA | recorded in the pull request after the merge (see §9) |
| Merge target | `main` |
| Deployment | **none** — this branch does not deploy |

---

## 1. Verdict

**PASS — VERIFIED V5 IMPLEMENTATION** on all local gates, pending the CI and
merge outcome recorded in §9.

Nine findings were audited. Seven were fixed, one was verified as a harness miss
rather than a defect, and one was measured and reported as **KEEP — VERIFIED**
with no production change. Six further defects were found by independent review
after the first pass and fixed. Nothing was manufactured to fill a batch.

---

## 2. Findings and disposition

| ID | Finding | Class | Disposition |
|----|---------|-------|-------------|
| V5-01 | The client never paginated, so every count was a filter over the newest 30 rows. `Unread` read 0 for an account with 20 unread rows older than the first page; the `99+` badge was unreachable. | B | **FIXED** |
| V5-02 | A blank checklist title failed every quick update with 400; an itemless blank checklist was silently deleted from the card on save. | A | **FIXED** |
| V5-03 | `activity-created` prepended frames from any board into the current board's feed. | A (scope) | **FIXED** — live activity deferred as D-1 |
| V5-04 | Provenance maps grow for the lifetime of the tab. | A / B | **KEEP — VERIFIED**, measured |
| V5-05 | A notification deleted while a read was in flight was resurrected by that read. | A | **FIXED** |
| V5-06 | Accepted and rejected invites reverted to `pending` when a read that predated the decision landed. | A | **FIXED** |
| V5-07 | The V4 deletion regression test answered with an empty payload, so it asserted the case that already worked. | A | **FIXED** — the test now fails at baseline |
| V5-08 | `docs/api-baseline.json` was stale, the V4 route hash was unreproducible, and the test that should have caught the rot compared against the stale document. | A | **FIXED** |
| V5-09 | V4 reported "list delete not verified". The two-step control exists and is wired end to end. | A | **NO CHANGE** — harness miss |

Full evidence: `KANVORA-V5-FIX-LEDGER.md`.

---

## 3. Implemented fixes

| Fix | Where |
|-----|-------|
| One overlay map carries read state, invite decisions and deletion tombstones with a monotonic mark; tombstones live until reset, read/status entries drop one generation later; a refused delete rolls back. | `Frontend/src/store/notificationStore.js` |
| `markAllRead` discards any read already in flight and leaves no flag stranded. | same |
| The user room is re-entered after a websocket reconnect, so delivery and the badge survive a transport drop. | same |
| `GET /notifications` also answers `unreadCount` and `total` from the same recipient filter, issued together with the list. | `Backend/controllers/notificationController.js` |
| The panel requests `limit=50`, appends with a generation guard, offers "Load older", and discloses unread rows beyond the loaded page. | `Frontend/src/store/notificationStore.js`, `Frontend/src/components/Notifications.jsx` |
| A blank checklist title is refused in the editor with an associated `role="alert"` message and withholds every request; the card save is refused with a named reason. | `Frontend/src/utils/cardSavePayload.js`, `CardChecklists.jsx`, `CardDetailModal.jsx` |
| `activity-created` is board-scoped. | `Frontend/src/store/projectSlices/socketSlice.js` |
| The route inventory document describes the application as it is and is enforced exactly, hash included. | `docs/api-baseline.json`, `Backend/tests/baseline.test.js` |

Eight application files changed: seven frontend, one backend. **No new
dependency** in either package.

---

## 4. Test evidence

| Suite | Baseline | V5 |
|-------|----------|----|
| Frontend | 62 files / 408 tests | **65 files / 456 tests, 0 failed** |
| Backend unit | 64 | **64, 0 failed** |
| Backend integration (real replica set) | 109 | **110, 0 failed, 0 skipped** |
| ESLint | 0 errors | **0 errors** |
| Production build | ok | **ok** |

Every fix has a test that failed against the untouched source. Six tests were
additionally **injection-tested** by reverting the fix and watching them fail:
five of the review corrections and one session-reset invariant. The deletion,
invite and checklist regressions were verified by stashing only the source files
and re-running the same tests, which is the same evidence one step earlier.

Detail: `KANVORA-V5-TEST-RESULTS.md`.

---

## 5. Backend compatibility

| Surface | Result |
|---------|--------|
| Routes | 71 definitions / 70 API definitions, unchanged |
| Canonical route hash | `aac8d3985def6a8187492490bd337d998b23d0e8c0a06a09bb6432ca38b8694a`, identical before and after |
| Methods, status codes, request bodies | unchanged |
| Response fields | two integers added to `GET /notifications`; `message` and `payload` unchanged |
| Consumers of that endpoint | one, in this repository; verified |
| Database schema | unchanged |
| Cross-recipient leakage | none — both counts use the same `{ user: req.user.id }` predicate as the list; a second recipient is asserted to see `total: 0` |
| Caching | `Cache-Control: no-store` and `Vary: Cookie` unchanged |

Detail: `KANVORA-V5-CONTRACT-DECISIONS.md`.

---

## 6. Two-browser verification

Real MongoDB replica set, real backend, real Socket.IO, real Vite dev server,
two isolated browser contexts with real cookie sessions, real HTTP.

**Baseline 28/47 — V5 49/49.** The same matrix was run against both trees.

Covered live: pagination and account-wide counts; a real socket delivery
reaching an open panel; a real `GET /notifications` response held mid-flight
while the user deletes a row; a peer creating a card seen in the other browser;
a transport drop with a change made while disconnected, then reconciliation and
room re-entry on reconnect; a blank checklist title producing zero writes and a
named refusal; account switching with no state bleed; axe-core with zero
violations of any impact on both scanned screens; reduced geometry checks at
360, 768 and 1280 px.

Detail: `KANVORA-V5-TEST-RESULTS.md` §3.

---

## 7. Performance

| Measure | Baseline | V5 | Delta |
|---------|----------|----|-------|
| `dist/assets` raw | 1933.1 KB | 1936.4 KB | **+0.17%** |
| `dist/assets` gzip | 1265.8 KB | 1267.0 KB | **+0.09%** |
| `GET /notifications` median, 5000 rows | 20.82 ms | 21.54 ms | **+3.46%** |
| `GET /notifications` p95, 5000 rows | 23.55 ms | 24.11 ms | **+2.38%** |

Provenance maps measured under a 480-card session: growth is proportional to
distinct cards touched (300 edits produced 120 entries), and the two surviving
maps need on the order of 10,000 distinct mutated cards in one page session to
reach 1 MB. **KEEP — VERIFIED.**

Detail: `KANVORA-V5-PERFORMANCE.md`.

---

## 8. Independent review

Four review dimensions were assigned: data integrity and async races, security
and API compatibility, client state and memory lifecycle, and accessibility and
regression coverage.

Two were delegated and completed independently — security/API compatibility and
client state/memory lifecycle. Two could not be delegated: the data-integrity
reviewer's model was unavailable, and no agent was configured for the
accessibility dimension. Those two were performed in this session, against the
source and the live application, and are reported as session work rather than as
independent review.

**Security and API compatibility: CLEAN.** No exploitable defect, no breaking
change, no P0/P1/P2. Three P3 notes, one of which (sequential queries) was
fixed and one of which (O(account) count cost) is recorded as an accepted
trade-off with its reasoning and its bound.

**Client state and memory: six findings confirmed and fixed** — a stranded
`loadingMore` flag, a user room not re-entered after reconnect, an offset window
shifted by deletes, an invites badge counting the loaded page next to two
account-wide badges, an ungated missing-rows note, and dead `unreadTotal` state.
One P3 (provenance maps surviving an account switch) was accepted under
V5-04's KEEP verdict. Each fix was injection-tested.

**No unresolved P0 or P1 remains.** Two P3 items are recorded rather than
changed, with reasons, in `KANVORA-V5-FIX-LEDGER.md`.

---

## 9. Release

Pull request **#4**, `feat/kanvora-v5-contract-closure` → `main`.

Every required job on the pull request passed before the merge:

| Job | Result |
|-----|--------|
| Frontend (test, lint, build) | pass — 42s |
| Backend (test, syntax) | pass — 18s |
| Backend integration (MongoDB replica set) | pass — 1m9s |
| Dependency audit (high/critical) | pass — 8s |
| Secret exposure scan | pass — 4s |

The merge commit SHA and the confirmation that local `main`, `origin/main` and
GitHub `main` agree are recorded on the pull request once the merge completes.

No force-push, no check bypass. This branch does not deploy: merging to `main`
runs CI on `main`, and no release or deployment step is part of this change.

---

## 10. Deferred product decisions

Not implemented, by design.

| ID | Decision |
|----|----------|
| D-1 | Build live board activity: a real emitter, board scoping, retention. |
| D-2 | Remove the dead activity handlers and banner (reachable once D-1 lands). |
| D-3 | The live-activity contract `{ _id, projectId, actor, type, message, createdAt }` emitted to `project:<id>`. |
| D-4 | Name the cause when board access is lost (401 and 403 are distinguishable; 404 is fail-closed by design). |
| D-5 | Cursor pagination for notifications. |
| D-6 | The remaining V3/V4 sibling defects outside the V5 scope. |

---

## 11. Unverified — never to be reported as passes

- Native screen-reader output (VoiceOver, NVDA, JAWS). axe-core and DOM
  association were checked; a real screen reader was not.
- Physical mobile hardware and touch gestures.
- Browser zoom at 125%, 150% and 200%.
- Real email delivery (SMTP was blank in the disposable backend).
- Cloudinary attachment storage.
- INP and field Web Vitals.
- Semgrep and CodeQL — **not installed**, so no SAST result is claimed.
- The full V4 486-check geometry matrix. A reduced check on the two changed
  screens was run instead.
- The full V4 theme matrix across all routes and themes.
- Notification volumes above `page <= 10000`.
- Distinguishing "board deleted" from "role removed" (D-4).
