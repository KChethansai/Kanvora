# Kanvora V5 — Contract Decisions

Scope: every API, payload and status-code decision made on
`feat/kanvora-v5-contract-closure`. Baseline
`87df5956bfb2ec24e15ea67e37a30475cfac4a1f`.

---

## 1. The one contract change

`GET /notifications` previously answered:

```json
{ "message": "Notifications fetched", "payload": [ ... ] }
```

It now also answers two integers:

```json
{ "message": "Notifications fetched", "payload": [ ... ], "unreadCount": 20, "total": 60 }
```

### Why

The client sent neither `page` nor `limit`, so the server always applied its
default of 30 rows. Every number in the interface was then a filter over those
30 rows:

- "All" was the page length, not the account.
- "Unread" was unread-among-loaded, which reads **0** for an account whose 20
  unread notifications are older than the newest 30 read ones.
- The `99+` badge branch could never be reached.

A page is not an account. A client that holds only page 1 cannot derive how
much it has not seen, and it must not present a lower bound as a fact. The
count therefore has to come from the same authority that produced the page.

### Why additive, and why no new endpoint

- `message` and `payload` are unchanged in name, type and order of meaning.
- No route was added, removed, re-mounted or re-methoded. The route inventory
  is **71 definitions / 70 API definitions**, canonical hash
  `aac8d3985def6a8187492490bd337d998b23d0e8c0a06a09bb6432ca38b8694a`,
  identical before and after the change.
- `unreadCount` and `total` are derived from the same recipient filter the list
  uses: `{ user: req.user.id }` and `{ user: req.user.id, read: false }`. Both
  are covered by existing indexes (`{ user, createdAt }` and `{ user, read }`),
  so the change adds two indexed counts and no new collection scan.
- The endpoint has exactly one consumer in the repository —
  `Frontend/src/store/notificationStore.js`. A grep for `/notifications` across
  both packages finds no other reader of this response.

### Why the client still falls back

`Number.isFinite` guards the two fields. An older server, or a proxy that
strips unknown properties, leaves `unreadCount` and `total` undefined; the
client then falls back to counting the loaded rows and never renders `NaN`.
The fallback is a lower bound, and it is only reachable against a server that
does not implement this contract.

### What the counts mean, precisely

- `total` — every notification the account holds, including rows not loaded.
- `unreadCount` — every unread notification the account holds.
- `unreadTotal` (client) — the last server-reported unread count.
- `unreadCount` (client, displayed) — the server count, plus live deliveries
  the response predates, minus local read/delete changes the response
  predates, clamped to `[0, total]`. It self-heals on the next response.
- Tab counts: "All" and "Unread" are account-wide. "Invites" is a filter over
  the loaded rows and is labelled as a count of what is loaded.

The unread tab shows the loaded unread rows and, when the account holds more
unread rows than are loaded, one line above the list saying so. It does not
silently page forward: paging on the user's behalf while they are reading would
move rows under the cursor.

---

## 2. Pagination contract (client side only)

The server already implemented `page` (1..10000) and `limit` (1..50) with a
deterministic sort of `{ createdAt: -1, _id: -1 }`. V5 adds no server
pagination; it uses what exists.

- Page size: 50, the server maximum.
- An append is only allowed directly after the page it extends
  (`get().page === page - 1`), so page 2 cannot graft onto a page 1 that was
  replaced.
- Every fetch takes a generation number; only the newest may write.
- An empty page past the end clears `hasMore` rather than leaving a control
  that asks forever for rows the server does not have.
- A failed page request keeps the loaded page and clears the spinner.

---

## 3. Notification overlay contract (client side only)

One `localOverrides` map carries three kinds of local mutation, each stamped
with a monotonic mark:

| Kind | Pruned? | Why |
|------|---------|-----|
| `deleted` | Never, until `reset()` | Absence from a page is not proof that the server deleted the row. The only exact rule is to keep the tombstone for the session. |
| `read` | One response generation after it is superseded | The next authoritative response carries the read state. |
| `status` (invite decision) | One response generation after it is superseded | Same. |

A refused `DELETE` removes its tombstone and restores the row at its original
index. An unprunable tombstone would otherwise hide a row that the server still
holds for the rest of the session, and would leave "Load older — N more"
counting a row that can never appear.

`markAllRead` bumps the fetch generation before it issues its request: the
server marks the whole account read, so a snapshot requested before that must
not land and report unread rows under a zero badge.

---

## 4. Checklist validation contract

The server already rejects a blank checklist title, validates the whole array,
and does so independently of item count (`text(list.title, 240, true)`). V5
changes nothing on the server.

The client now agrees with the server:

- `checklistTitleError(checklists)` returns the first invalid index, or `-1`.
  It is array-wide and item-count-independent.
- The editor shows the reason next to the offending title, marks the input
  `aria-invalid`, points `aria-describedby` at a `role="alert"` element, keeps
  the draft exactly as typed, and withholds the request.
- The card save is refused with a named reason instead of sending a payload the
  server answers with 400.
- A blank title is invalid **even when the checklist has no items**. The editor
  previously filtered an itemless blank checklist out of the payload, which
  would `$set` the array without it and delete it from the card. There is no
  delete-checklist control, so blocking the save is the only behaviour that
  does not lose data.

A contract guard in `project-security.test.js` pins the server rejection for
both the itemless and the populated case, so relaxing it later fails a test
rather than silently letting a checklist disappear.

---

## 5. Board activity contract

`activity-created` is board-scoped. The handler drops a frame that is not an
object or does not carry the current `projectId`. The feed is capped at 60 rows
and carries no board column, so one foreign row would sit among this board's
work for the rest of the session with nothing to distinguish it.

There is no production emitter for this event; all four `.emit` sites are
tests. Building live activity is **D-1**, deferred. The contract it must satisfy
is **D-3**:

```json
{ "_id": "...", "projectId": "...", "actor": { "_id": "...", "name": "..." },
  "type": "card-moved", "message": "...", "createdAt": "ISO-8601" }
```

emitted to `project:<id>`, authorized by current board membership, and capped
at 60 client-side.

---

## 6. Rejected designs

| Design | Rejected because |
|--------|------------------|
| Prune `localCardCreations` during a card read | `fetchCards` is per-list and fanned out concurrently. A later read of another list would drop a card a different read had just confirmed, which is the V4-02 regression. |
| Clear the card generation maps on session reset | Clearing without a never-reset counter recycles ownership numbers, so a stale response passes its guard and overwrites a fresh board. |
| TTL or size-capped eviction for provenance | Either it evicts an entry that is still needed (a correctness bug) or it does not bound anything in practice. |
| Per-checklist validation UX (one error at a time per keystroke, debounced) | The payload is the whole array; every edit is invalid until every title is valid. A per-field debounce would still fire invalid requests. |
| Refetch everything after each mutation | Turns every keystroke into a full board read and reintroduces the stale-read races the provenance maps exist to prevent. |
| Server-side contract versioning | One additive field pair with one consumer does not justify a version negotiation layer. |
| New paginated notifications endpoint | The server already paginates. A new endpoint would duplicate the recipient filter and add a second place to get authorization wrong. |

---

## 7. Compatibility summary

| Surface | Change | Compatible |
|---------|--------|------------|
| Routes | none (71/70 before and after) | yes |
| Methods | none | yes |
| Status codes | none | yes |
| Request bodies | none | yes |
| Response fields | two added integers on `GET /notifications` | yes — additive |
| Cookie / auth | none | yes |
| Socket events | none added or removed; `activity-created` now validates `projectId` | yes |
| Database schema | none | yes |
| Dependencies | none added, none removed | yes |
