# Kanvora V5 — Fix Ledger

Baseline: `87df5956bfb2ec24e15ea67e37a30475cfac4a1f`
Branch: `feat/kanvora-v5-contract-closure`
Plan: `/home/chethan/.opencode/plan/KANVORA-V5-*.md`

Every row below was reproduced before it was changed. "RED" is the number of
tests that failed against the untouched source; a test that passed against the
untouched source is listed as a guard, not as evidence of a defect.

---

## Findings and disposition

| ID | Finding | Class | Disposition | Evidence |
|----|---------|-------|-------------|----------|
| V5-01 | The client never sends `page`/`limit`, so it only ever holds the newest 30 rows and derives every count from them. The 99+ badge branch is unreachable and unread is under-reported above the first page. | B | **FIXED** | 10 RED |
| V5-02 | A blank checklist title makes every quick update fail with 400. An itemless blank checklist is silently dropped from the payload, which deletes it from the card with no control to restore it. | A | **FIXED** | 8 RED + 1 RED |
| V5-03 | The `activity-created` handler prepends every frame to the board feed without checking which board it belongs to. | A (scope) / D (feature) | **FIXED (scope)** — live activity stays deferred as D-1 | 2 RED |
| V5-04 | Provenance maps in `cardSlice` grow for the lifetime of the tab. | A / B | **KEEP — VERIFIED** — measured, no defect demonstrated | 2 guards, injection-tested |
| V5-05 | A notification deleted while a read is in flight is resurrected by that read. `forgetNotification` erased the only evidence of the deletion. | A | **FIXED** | 1 RED (unit) + 1 FAIL (live) |
| V5-06 | An accepted or rejected invite reverts to `pending` when a read that predates the decision lands. | A | **FIXED** | 2 RED |
| V5-07 | The V4 deletion regression test answered with an empty payload, so it asserted the one case that already worked. | A | **FIXED** | the test now fails at baseline |
| V5-08 | `docs/api-baseline.json` was stale (`phase: B0`, `0bea03a`, 72/71, still listing the retired `/api/project` and `/api/task`), the V4 route hash could not be reproduced under twelve canonicalisations, and `baseline.test.js` compared the live inventory against that stale document plus a hardcoded patch list — so it could not fail when the document rotted. | A | **FIXED** | regenerated; the test now compares the live inventory to it exactly, including a documented canonical hash |
| V5-09 | V4 reported "list delete not verified". The two-step control exists and is wired end to end. | A | **NO CHANGE** — harness miss, not a defect | source read |

`V5-04` is the only finding where the plan allowed "no change". The measurement
and the two invariants it depends on are recorded in
`KANVORA-V5-PERFORMANCE.md` and pinned by tests.

---

## Batches

| Batch | Commit | Files | What it does |
|-------|--------|-------|--------------|
| 1a | `8488b54` | `notificationStore.js`, `notification-mutation-reconciliation.test.js` | One `localOverrides` map for read, status and deletion. Deletion tombstones live until reset; read/status entries are pruned one response generation later. A refused `DELETE` rolls its tombstone back. `markAllRead` discards any read already in flight. |
| 1b | `57f7df3` | `notificationController.js`, `notificationStore.js`, `Notifications.jsx`, `notification-pagination.test.js`, `notification-panel.test.jsx`, `notification-security.test.js`, `profile-and-controls-accessibility.test.jsx` | Server answers `unreadCount` and `total`; client asks for `limit=50`, keeps `page`/`total`/`hasMore`, appends with a generation guard, and offers "Load older". |
| 2 | `6019688` | `cardSavePayload.js`, `CardChecklists.jsx`, `CardDetailModal.jsx`, `card-save-payload.test.js`, `card-editor-save-payload.test.jsx`, `checklist-validation.test.jsx`, `project-security.test.js` | `checklistTitleError` is array-wide and item-count-independent. The editor explains the blank title inline and withholds the request; the card save is refused with a named reason. Server contract unchanged, now pinned. |
| 3 | `aa717e9` | `socketSlice.js`, `board-room-admission.test.js` | `activity-created` applies the same `inBoard` guard the list and card handlers already use, and drops frames that carry no board. |
| 4 | `f24bacb` | `card-creation-provenance.test.js` | **No production change.** Measurement recorded; the two session-reset invariants the KEEP depends on are pinned. |
| 5 | `1447855` | `notificationStore.js`, `Notifications.jsx`, `notificationController.js`, `baseline.test.js`, `docs/api-baseline.json`, four test files | Independent-review corrections (R-1 to R-6 below). |

---

## Independent-review corrections

Four reviewers were asked to challenge the implementation. Six findings were
confirmed against the source and fixed in `1447855`; each fix was
injection-tested by reverting it and watching its test fail.

| ID | Finding | Severity | Fix |
|----|---------|----------|-----|
| R-1 | `markAllRead` bumped the fetch generation but cleared only `loading`. An append already in flight was discarded while `loadingMore` stayed true, so the "Load older" control stayed disabled for the rest of the session. A failed page-1 reload had the same effect. | P2 | Every terminal path clears both flags. |
| R-2 | The user room lives on the connection. A websocket reconnect creates a new one, `bindUserRoom` short-circuits on `socketBound`, and the reconnect handler re-emitted only `join-project` — so live notification delivery and the badge stopped for the rest of the session. `joinUserRoom` existed with zero callers. | P2 | `bindUserRoom` registers a `connect` listener that re-enters the user room; it is removed before replacement and released with the socket. |
| R-3 | A delete inside the loaded window shifts the server's offset pagination, so the next page skips one row and `total - loaded` stops being an exact count. The control promised a number that could never arrive. | P2 | The control says "Load older" without a number once the window has shifted, until a fresh first page re-aligns it. Cursor pagination remains **D-5**. |
| R-4 | The Invites badge counted the loaded page while its two neighbours counted the account, so three adjacent numbers meant two different things. | P2 | The Invites tab carries no badge. |
| R-5 | The "older unread not loaded" note had no `hasMore` gate, so it could persist with every page loaded and nothing on the screen able to clear it. | P3 | The note requires `hasMore`. |
| R-6 | `unreadTotal` was written in four places and read in none, and delivered rows stamped at or before a request's mark could never satisfy a later retention check. | P3 | `unreadTotal` removed; unreachable delivered rows are swept after a successful read. |

Two further corrections came out of the same review:

- The list and both counts were issued sequentially. They are now issued
  together, so the request pays one round trip rather than two.
- `docs/api-baseline.json` was regenerated, and `baseline.test.js` now compares
  the live inventory to it **exactly**, including the canonical hash. The old
  test compared against the stale B0 document plus a hardcoded patch list, which
  is precisely why the document could rot without failing anything. Regenerating
  the document therefore broke that test first, which is the correct outcome.

Findings that were **not** acted on, with reasons:

| Finding | Decision |
|---------|----------|
| The two `countDocuments` calls make each request O(account) rather than O(page). | Accepted. Both are covered index scans, the global rate limit is 300 requests per 15 minutes per IP, and the work is on the caller's own rows. Bounding it would need a cached counter or a TTL, both of which are product decisions. Recorded rather than changed. |
| The post-await page guard in `fetchNotifications` cannot fire, because every path that changes `page` also bumps the generation. | Kept as defence in depth, with the test renamed to what it actually proves. Removing it would leave nothing if the generation logic is ever narrowed. |
| `localOverrides` deletion tombstones live for the whole session. | Deliberate and documented: absence from a page is not proof of deletion. Bounded by user delete actions, not by traffic. |
| The two card generation maps survive an account switch. | Measured under V5-04 and reported KEEP — VERIFIED. No correctness impact; the values are only compared for equality within one request's lifetime. |
| `hasMore` can stay true across a page that adds no new rows. | The empty-page guard terminates it. Not a defect, but noted. |

---

## What changed, and what deliberately did not

**Changed**

- `GET /notifications` returns `unreadCount` and `total` in addition to
  `message` and `payload`. Additive; no route, method or status code changed.
- The user room is re-entered after a websocket reconnect, so delivery and the
  badge survive a transport drop.
- `docs/api-baseline.json` is regenerated and now enforced by a test.
- The notification panel requests `limit=50` and can append further pages.
- Notification deletions, invite decisions and read state survive an in-flight
  read; a failed delete rolls back instead of hiding the row.
- A blank checklist title is refused in the editor and named in the card save.
- `activity-created` is board-scoped.

**Deliberately unchanged**

- The list/card deletion controls. V4 called the list delete "not verified";
  the two-step control is present and wired. Nothing was added to satisfy a
  test.
- `localCardCreations` is **not** pruned. `fetchCards` is per-list and fanned
  out concurrently, so pruning it during one read would drop a card another
  read had just confirmed.
- The generation maps in `cardSlice` are **not** cleared. Clearing them would
  recycle ownership numbers and let a stale card response pass its guard.
- No server-side versioning, no cursor pagination, no notification TTL, no
  refetch-everything-after-mutation.
- No new dependency, in either package.

---

## Deferred product decisions

These are product or contract decisions, not defects, and are not implemented.

| ID | Decision | Why it is deferred |
|----|----------|--------------------|
| D-1 | Build live board activity (a real emitter, board scoping, retention). | There is no production emitter for `activity-created`. The feed, the socket handler and the banner exist; the server side does not. Adding one is a feature, not a correction. |
| D-2 | Remove the dead activity handlers and the banner. | They are reachable once D-1 lands. Removing them now would delete the contract the plan specifies for it. |
| D-3 | Live-activity contract: `{ _id, projectId, actor, type, message, createdAt }`, emitted to `project:<id>`, authorized by board membership, capped at 60 client-side. | Specified, not implemented. The V5 guard already enforces `projectId`. |
| D-4 | Name the cause when board access is lost (401 vs 403 vs 404). | 401 and 403 are distinguishable; 404 is fail-closed by design, so "board deleted" and "role removed" cannot be told apart without a new server signal. |
| D-5 | Cursor pagination for notifications. | `skip`/`limit` is adequate at the observed scale; `page` is capped at 10000. A cursor is a contract change with no measured need. |
| D-6 | The remaining V3/V4 sibling defects outside the V5 scope. | Out of scope for this branch. |

---

## Unverified — never to be reported as passes

- Native screen-reader output (VoiceOver, NVDA, JAWS). axe-core and DOM
  association were checked; a real screen reader was not.
- Physical mobile hardware and touch gestures.
- Browser zoom at 125%, 150% and 200%.
- Real email delivery. SMTP was blank in the disposable backend.
- Cloudinary attachment storage.
- INP and field Web Vitals.
- Semgrep Pro and CodeQL. Semgrep OSS and CodeQL were not available in this
  environment, so **no static-analysis scan was run** and none is claimed.
- Notification volumes above `page <= 10000`.
- Distinguishing "board deleted" from "role removed" (D-4).
