# Kanvora V4 — fix ledger

Baseline `a08046c33baa9326e097a3bfaee6aff3433466d4` (the released V3 build).
Every fix below was **reproduced first**, then covered by a regression test
that fails without the fix, then verified in a real browser, and then
committed on its own.

No runtime dependency, backend route, payload contract, status-code
semantics, permission rule, schema, theme token, drag sensor or component was
changed. The backend tree and both manifests are byte-identical to the
baseline; the route inventory hash is unchanged
(`71f6098b6451139df77900738e56409046a22b68aca81c7f32562425f7ec937e`).

---

## The fixes

| ID | Severity | Commit | Root cause | Correction | RED → GREEN evidence |
|---|---|---|---|---|---|
| V4-01 | P1 | `42a1ab8` | The board effect awaited the list read and the project read **before** `joinProject`, so a peer change made in that window was delivered to nobody and covered by no read. | The room is joined **before** the authoritative reads. A change is then either part of the read or delivered live. | Browser RED: the list was missing from B although the server held it. GREEN: present without a reload. Unit RED: the source-order assertion failed. |
| V4-02 | P1 | `04c6ab8` | `fetchCards` replaced the collection with the server payload, so a card created after that snapshot was taken was deleted from the board — the list path already had a protection for exactly this and the card path did not. | Card creations are marked with a monotonic mark; a read retains the cards it could not have seen. The socket marks peer creations, moves and clears deletions. | Unit RED: `markCardCreation is not a function`, then the retention assertion failed. GREEN: 3/3 and the socket-path tests. Browser RED: the peer card was removed from B. GREEN: it survives. |
| V4-03 | P1 | `9e0dc86` | The card editor submitted the whole form and the server applies the submitted fields with `$set`, so a field the user did not touch overwrote a concurrent change with a stale value. | The editor sends only the fields that changed, measured against the card **as it was opened**. The server already accepts a partial body. | Browser RED: the server title reverted to the original. GREEN: A's title survives; the payloads are `title+description` and `description`. Unit RED: 6 payload cases. |
| V4-04 | P1 | `e12a17f` | The client treated a server-initiated disconnect like any other, so a role change was never learned: the board kept edit controls the server refused and the user was never told. | A server-initiated disconnect revalidates the board, so the capabilities and the controls derived from them match what the server accepts. | Browser RED: 2 stale "Add a card" controls, `capabilities.edit=false`, and **zero** revalidation requests. GREEN: a View-only badge and 0 edit controls. |
| V4-05 | P1 | `af26c22` | The notification store had no request generation and no creation provenance, so a read that was in flight replaced a live delivery. | The read is generation-guarded, a live delivery is remembered and merged back, the count is always recomputed from the collection, and a delivery is de-duplicated by `_id`. | Unit RED: 3 of 4 cases failed. Browser RED: the notification was lost (`count=0`). GREEN: it survives and is not duplicated. |
| V4-10 | P2 | `ec1aa63` | A failed card read was swallowed, so a board that could not be read looked exactly like an empty board. | The failure is classified and recorded per list, and the board reports it with a retry. | Unit RED: the store had no failure record. Browser RED: the board showed no error. GREEN: the failure is reported. |
| V4-08 (part) | P2 | `6a6671f` | Every failure produced the same message, so an expired session, a revoked permission, a rate limit and a lost connection were indistinguishable. | One classifier maps the failure to a cause, and the card write path reports it. | Unit RED: `requestErrorKind is not a function` / the store had no cause. GREEN: 7/7. |
| V4-11 | P1 | `26e747f` | Found by the **independent review** of the V4 change: a notification deleted while a read was in flight was resurrected by that read. | A deletion forgets the notification, so a read cannot bring it back. | Unit RED: the deleted notification reappeared. GREEN: it stays deleted. |
| V4-12 | P2 | `26e747f` | Found by the independent review: a notification marked read while a read was in flight was put back into the unread count. | The local read state is remembered and wins over a response that predates it. | Unit RED: the notification was unread again. GREEN: it stays read. |

### Further corrections folded into `26e747f`

- `cardWriteError` is cleared when a write starts and on a board reset, so a
  stale cause cannot be shown for a later failure.
- A local move now marks the card as a creation for its destination list, so a
  read of the destination that starts before the server commits cannot drop
  it.
- A card whose due date cannot be parsed is treated as absent, so the editor
  can never fail to open on an unusable date.

---

## The regressions that protect the fixes

New test files, all of which fail without their fix:

| File | Tests | What it locks |
|---|---|---|
| `Frontend/src/tests/card-creation-provenance.test.js` | 3 | A card created while a read is in flight survives; a deleted card does not come back; a card the server still has is replaced by the server version. |
| `Frontend/src/tests/card-provenance-socket.test.js` | 3 | The same on the **real socket path**: a peer creation, a peer deletion and a peer move. Removing the socket wiring fails these. |
| `Frontend/src/tests/notification-read-reconciliation.test.js` | 4 | A live delivery survives a read; the count is recomputed; a delivery after a read is not duplicated; an older read does not win. |
| `Frontend/src/tests/notification-mutation-reconciliation.test.js` | 3 | A deletion is not undone by a read; a read state is not undone by a read; marking all read keeps the count at zero. |
| `Frontend/src/tests/board-room-admission.test.js` | 3 | The room is joined before the reads; every board event has a handler; a peer list created while loading is kept. |
| `Frontend/src/tests/access-revalidation.test.js` | 3 | A server-initiated disconnect revalidates; a transport drop does not; a server-closed socket is not reconnected. |
| `Frontend/src/tests/card-save-payload.test.js` | 6 | The payload carries only the changed fields, a cleared field is sent, an untouched empty estimate is not a change, the assignment is sent as `memberIds` only. |
| `Frontend/src/tests/card-editor-save-payload.test.jsx` | 3 | The **editor** sends only the edited field, sends nothing when nothing changed, and sends a cleared field. |
| `Frontend/src/tests/request-failure-visibility.test.js` | 7 | The failure classification, the recorded read failure and the recorded write cause. |

**Frontend suite: 62 files, 408 tests, 0 failures** (baseline 53 files, 373
tests).

The independent test reviewer verified the fail-on-revert property
experimentally, in a throwaway copy, by restoring the baseline files: the
behavioural tests fail without their fix. It also identified the tests that
pass either way, and every one of those was rewritten to exercise the
behaviour — the socket-path provenance tests, the editor-payload test and the
notification-mutation tests are the result.

---

## Rejected and deferred work

| Item | Decision | Reason |
|---|---|---|
| A socket write path (mutations over the socket) | Rejected | The server is the only mutation authority; a second path would create a second authorization surface. |
| Server-side optimistic concurrency (version field, `If-Match`, `409`) | Rejected | A backend contract change, a migration and a new client failure mode — and unnecessary, because the server already accepts a partial body. |
| Virtualisation, `content-visibility: auto` | Rejected | No measured benefit; the drag and keyboard contracts would need re-proving. |
| Wiring the live activity feed | Deferred | The server never emits `activity-created` and the client's payload shape does not match the stored model. A new contract and a product decision, outside V4. |
| Paginated notifications | Deferred | Needs a new or changed server endpoint. Recorded as a sibling defect. |
| Retyping every failure message | Partial | The classifier exists and is used on the card write path; the remaining call sites keep their existing copy, which is accurate if uninformative. |
| A second independent implementation of the concurrency guards | Rejected | V4 extends the existing guards rather than adding a parallel mechanism. |
