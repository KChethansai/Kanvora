# Kanvora V4 — multi-user concurrency results

Baseline `a08046c33baa9326e097a3bfaee6aff3433466d4` → released
`dbf09d8cc3e2f1d91c7f8c82f8ff52d7faf7ec7b` (V3) → V4 implementation
`26e747f`.

Every scenario below ran against the **real** Express backend, the **real**
Socket.IO server and a **disposable MongoDB 8.2.6 replica set** outside the
repository, with two or more **independent Playwright browser contexts**
(separate cookies, storage and sockets). Nothing was mocked. The only
replacement was the mail transport, because SMTP is not configured: the
application's own verification and invitation links are used, so the real
account-verification and invitation-acceptance paths are exercised. Email
*delivery* is not claimed.

Harness: `/home/chethan/.tmp/opencode/kanvora-v4-tools/matrix.mjs` and
`targeted.mjs` (outside the source tree). Ledgers:
`scenario-ledger-final.json`, `targeted-ledger-final.json`.

**Final matrix: 38 assertions, 0 FAIL, 2 NOT VERIFIED.**
**Targeted reproductions: 11 assertions, 0 FAIL.**

---

## 1. The confirmed defects, before and after

| ID | Defect | Reproduction | Before | After |
|---|---|---|---|---|
| V4-01 | The board joined its socket room only after the initial reads, so a peer change made during the load was lost until a reload. | `V4_01_preJoinLoss`: B's project-detail response held, A creates a list, response released. | The list was **missing** from B although the server held it. | The list is **present** in B without a reload. |
| V4-02 | An in-flight card read replaced the whole collection, deleting a card another member had just created. | `V4_02_cardReadDropsPeerCard`: B's card read held, A creates a card, the socket event delivers it, the read lands. | The peer card was **removed** from B's board. | The peer card **survives** and the server still holds it. |
| V4-03 | The card editor submitted the whole form, so two members editing the same card overwrote each other. | `C2`: A changes title+description, B changes the description, both save. | A's title was **lost** (`server title = "V4 C2 card …"`). | A's title **survives**; the saves carry `title+description` and `description` only. |
| V4-04 | The client never learned that its own access changed, so it kept an editable board the server refused to write to. | `C4`: the owner's role change demotes the editor. | The client still offered "Add a card" (**2 controls**) with `capabilities.edit=false`; **no revalidation request was made**. | The board shows a **View-only** badge and offers **0** edit controls. |
| V4-05 | A notification read that was in flight replaced the collection and wiped a live delivery. | `V4_05_notificationOrder`: the read is held, the invitation is created, the live delivery arrives, the read lands. | The notification was **lost** (`count=0, unread=0`). | The notification **survives** (`count=1, unread=1`), and a delivery after a read is not duplicated. |
| V4-10 | A failed card read was swallowed, so a broken board looked like an empty one. | `C9`: the card read is answered with 503. | The board showed no error. | The board **reports the failure** with a retry. |

Two further defects were found by the independent review of the V4 change
itself and fixed before the release:

| ID | Defect | Before | After |
|---|---|---|---|
| V4-11 | A notification deleted while a read was in flight was resurrected by that read. | The deletion was undone. | The deletion stands. |
| V4-12 | A notification marked read while a read was in flight was put back into the unread count. | The unread count was wrong. | The local read state wins. |

---

## 2. Scenario ledger

### C1 — two-browser synchronisation
| Assertion | Result | Evidence |
|---|---|---|
| C1.1 a list created in A appears in B without a reload | PASS | `shots/C1-editor.png` |
| C1.2 a card created in A appears in B without a reload | PASS | |
| C1.3 a card title edited in A appears in B | PASS | |
| C1.6 the dragged card is in the destination list in B | PASS | |
| C1.6b the source list no longer holds the card in B | PASS | |
| C1.6c the server records the card once, in the destination | PASS | server read-back |
| C1.7 a card deleted in A disappears in B | PASS | |
| C1.8 a list deleted in A disappears in B | **NOT VERIFIED** | the list-actions menu exposed no delete control in this build; the list delete path is covered by the backend integration suite, not by this browser step |
| C1.9 the live socket carried the board events to B | PASS | frames: `list-created, card-created, cards-reordered×3, card-updated×2, card-deleted` |
| C1.10 a list created while B was loading the board is visible in B | PASS | was FAIL before the V4-01 fix |

### C2 — concurrent editing
| Assertion | Result | Evidence |
|---|---|---|
| C2.3 each save request carries only the fields that user changed | PASS | `title+description` \| `description` |
| C2.4 A's title survives B's concurrent save | PASS | server title `V4 C2 title …`, description `… by B` |
| C2.5 B converges to the server document | PASS | |

The documented conflict policy is unchanged and is now **field-level
last-write-wins on the submitted fields**. Two members editing the *same*
field still resolve as last-write-wins, with no merge and no conflict UI.
That is the existing policy and V4 did not change it; V4 removed the
overwriting of fields the user did not touch.

### C3 — reconnection
| Assertion | Result | Evidence |
|---|---|---|
| C3.1 a change made while B was offline reaches B after reconnecting | PASS | |
| C3.2 the socket has at most one application listener per event after reconnecting | PASS | `card-created 1, card-updated 1, list-created 1, lists-reordered 1, new-notification 1` |

### C4 — permissions during an active session
| Assertion | Result | Evidence |
|---|---|---|
| C4.1 the role change is accepted by the server | PASS | 200 |
| C4.3 the demoted member's write is refused by the server | PASS | 404 |
| C4.4 the demoted client is told that its access changed | PASS | a **View-only** badge |
| C4.6 the client no longer offers edit controls the server now refuses | PASS | 0 "Add a card" controls, `capabilities.edit=false` |

### C5 — stale responses across a switch
| Assertion | Result | Evidence |
|---|---|---|
| C5.1 a held workspace read does not override the current selection | PASS | selection unchanged before and after the release |
| C5.2 a held card read does not repopulate a board that was left | PASS | 0 card buckets |

### C6 — filter change during a drag
| Assertion | Result | Evidence |
|---|---|---|
| C6.1 the status filter control is available | PASS | 3 menu items |
| C6.2 the card is in exactly one list after a filter change during a drag | PASS | |
| C6.3 the server holds the card in exactly one list | PASS | server read-back |

### C7 — notification state
| Assertion | Result | Evidence |
|---|---|---|
| C7.1 the project invitation is created | PASS | 201 |
| C7.2 the invite notification reaches the recipient | PASS | `unread=1` |
| C7.3 the notification is not duplicated | PASS | 1 occurrence |
| C7.4 the notification count is stable after a reload | PASS | 1/1 before and after |
| C7.5 marking a notification read updates the counter | PASS | `unread=0` |

### C8 — session expiry
| Assertion | Result | Evidence |
|---|---|---|
| C8.1 the password change succeeds and issues a new session | PASS | 200 |
| C8.3 the other session is refused by the server | PASS | 401 |
| C8.4 the revoked client stops presenting the board and offers a way back | PASS | "This board is not available" + "Back to your workspace" |
| C8.5 the message distinguishes an expired session from a removed role | **NOT VERIFIED** | the copy is generic: it does not name the cause. The access **loss** is communicated and recoverable; the **cause** is not. |

### C9 — failure recovery
| Assertion | Result | Evidence |
|---|---|---|
| C9.2 a failed card read is visible to the user | PASS | the board reports the failure |

### C10 — isolation
| Assertion | Result | Evidence |
|---|---|---|
| C10.1 an outsider is refused the shared board | PASS | HTTP 404, "This board is not available" |
| C10.2 no board data leaks into the outsider DOM | PASS | no card, list or member name present |
| C10.4 a viewer can read the shared board | PASS | |
| C10.5 a viewer write is rejected by the server | PASS | HTTP 404 |

---

## 3. How a timing-sensitive defect was made deterministic

Three defects only appear when a peer change lands between a read and the
board's live channel. They were reproduced by holding a **real** server
response in the browser (`route.fetch()` performs the request against the real
server, and only the delivery of the response to the page is delayed), so the
server really produced the payload and the socket really carried the frame.
No API call was mocked and no socket frame was synthesised.

The three orderings exercised:

1. **read before the live frame, frame after the read** — the live change is
   lost (V4-05).
2. **live frame before the read** — the read is authoritative and correct.
3. **live frame delayed past the read** — the change must not be duplicated.

---

## 4. Explicitly NOT VERIFIED in the browser

- **Native screen-reader output** (NVDA / VoiceOver / TalkBack). No assistive
  technology was available. The accessibility scan is automated only.
- **Physical mobile hardware.** Touch was emulated, which is not the same
  thing; the emulation is reported as emulation.
- **Native browser zoom at 125 / 150 / 200 %.** The persistent-profile zoom
  attempt did not change the device pixel ratio, so it is not claimed.
- **A list deleted in one browser disappearing in the other** (C1.8) — the
  list-actions menu exposed no delete control.
- **The cause of an expired session being named in the message** (C8.5).
- **Recovery email delivery and Cloudinary storage** — both need external
  services. The negative paths (rejected upload, recovery form) were tested;
  delivery is not claimed.
- **Field Web Vitals / INP** — no field or RUM source is available.

## 5. Pre-existing sibling defects found but not fixed

Found during the V4 work, reproducible but outside the V4 change set. They are
recorded so the next pass does not rediscover them.

| Sibling | Where | Why it was not fixed in V4 |
|---|---|---|
| The notification list is read once and unpaginated, while the server caps a page at 30, so older notifications and the unread count can be incomplete. | `Frontend/src/store/notificationStore.js` (fetch) vs `Backend/controllers/notificationController.js` (limit) | A correct fix needs a paginated notification endpoint — a backend contract change, outside the V4 scope. |
| A checklist whose title is whitespace but which has items is kept by the client and then rejected by the server. | `Frontend/src/utils/cardSavePayload.js`, `Backend/APIs/ProjectsAPI.js` | Pre-existing; the server rejects the same body before V4. The client filter was kept identical so the change stays a pure concurrency fix. |
| The `activity-created` event is not scoped to the active board. | `Frontend/src/store/projectSlices/socketSlice.js` | Pre-existing and unreachable in production: the server never emits it. The dead live-activity surface is recorded, not built. |
| The local card-creation and notification maps grow for the life of a session. | `cardSlice.js`, `notificationStore.js` | Bounded by card and notification turnover; entries are cleared on reset and on deletion. |
