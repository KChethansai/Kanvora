# Kanvora V5 — Performance

Baseline `87df5956bfb2ec24e15ea67e37a30475cfac4a1f` → branch head
`feat/kanvora-v5-contract-closure`.

Every figure below was measured, not estimated. The comparison is always the
baseline worktree built from the same lockfile against the branch worktree, on
the same machine, in the same session.

---

## 1. Bundle

| Measure | Baseline | V5 | Delta |
|---------|----------|----|-------|
| `dist/assets` total, raw | 1933.1 KB | 1936.4 KB | **+0.17%** |
| `dist/assets` total, gzip | 1265.8 KB | 1267.0 KB | **+0.09%** |
| JS chunks | 37 | 37 | 0 |
| CSS files | 1 | 1 | 0 |

No chunk was added, removed or split. The 3.3 KB raw difference is the new
pagination store, the "Load older" control and the checklist validation path.

The gate is "no unexplained regression greater than 10%". The measured figure is
two orders of magnitude below it and every byte is accounted for by code that
was asked for.

No dependency was added, so no third-party weight entered the bundle.

---

## 2. Notification endpoint latency

Real backend, real MongoDB replica set, one recipient holding **5000**
notifications, `GET /notifications?page=1&limit=50` — the page size the client
actually requests. 10 warm-up requests discarded, 40 measured.

| Measure | Baseline | V5 | Delta |
|---------|----------|----|-------|
| median | 20.82 ms | 21.54 ms | **+3.46%** |
| p95 | 23.55 ms | 24.11 ms | **+2.38%** |
| min | 18.14 ms | 19.53 ms | +7.66% |
| max | 25.75 ms | 24.81 ms | −3.65% |

The cost of answering the two account-wide counts at 5000 rows is about
0.7 ms on the median. Both counts are covered by existing indexes
(`{ user, createdAt }` and `{ user, read }`), and the list plus both counts are
issued in one `Promise.all`, so the request still pays a single round trip.

The baseline response for the same request carries no `total` field
(`null` in the measurement); the V5 response reports `total: 5000`. That is the
contract change, measured rather than asserted.

Honest limits of this number:

- It measures a warm single-process backend with no reverse proxy, no TLS and no
  network latency. It compares the two implementations, not production.
- 5000 rows is a chosen fixture, not an observed production volume. Cost grows
  with the recipient's notification count, and nothing in the application bounds
  that count — notifications have no TTL. This is recorded as an accepted
  trade-off in the fix ledger, not as a solved problem.
- The global rate limit (300 requests per 15 minutes per IP) bounds how often a
  single caller can pay it.

---

## 3. Client memory: provenance maps (V5-04)

The plan required measuring before changing any map. The measurement was taken
by instrumenting a throwaway copy of `cardSlice.js` with a size accessor,
running a synthetic session, recording the numbers, and then reverting the
instrumentation. The accessor is **not** in the shipped source; the working tree
was verified clean afterwards.

Workload: 8 lists × 60 cards = 480 cards, 300 edits across 120 distinct cards,
120 moves across 120 distinct cards.

| Map | Entries after the session | After `resetCardFetches()` |
|-----|---------------------------|----------------------------|
| `cardFetchGeneration` | 8 | 0 |
| `cardCommitted` | 1 (the mock returned one updated card) | 0 |
| `localCardCreations` | 480 | 0 |
| `cardMutationGeneration` | 120 | **120** |
| `cardMoveGeneration` | 120 | **120** |

Total `heapUsed` for the whole vitest process after the session: 74.35 MB
(dominated by jsdom and the 480 card objects, not by these maps).

What the numbers say:

- Growth is proportional to **distinct cards touched**, not to edits and not to
  elapsed time. 300 edits produced 120 entries, one per card.
- `cardMutationGeneration` and `cardMoveGeneration` are the only maps that
  survive `resetCardFetches()`. At roughly 60–100 bytes per entry, reaching 1 MB
  would take on the order of 10,000 distinct mutated cards in a single page
  session.
- `localCardCreations` is cleared on reset and is **not** pruned by a read. That
  is deliberate: `fetchCards` is per-list and fanned out concurrently, so
  pruning it during one read would drop a card another read had just confirmed.

Verdict: **KEEP — VERIFIED.** No production change. Bounding the two surviving
maps would mean rewinding ownership counters, which is the one change that can
make a stale card response pass its guard — a correctness risk taken to save
tens of kilobytes. The two invariants the verdict depends on are pinned by
tests, and rewinding `nextCardFetchGeneration` in the reset was injected
temporarily to prove the guard actually fails.

---

## 4. Client memory: notification state

| Collection | Bound | Cleared by `reset()` |
|------------|-------|----------------------|
| `localNotifications` | Rows delivered since the last successful read; swept after each read | yes |
| `localOverrides` (read/status) | Rows mutated since the last response, dropped one generation later | yes |
| `localOverrides` (deleted) | One small entry per notification the user deleted this session | yes |

The deletion tombstones are the only entries that live for a whole session, and
they are bounded by user actions rather than by traffic. Absence from a page is
not proof that the server deleted a row, so the exact rule is to keep them.

Delivered rows stamped at or before a read's mark can never satisfy a later
retention check, so they are swept after a successful read. That is a
memory-only change; it has no observable behaviour and therefore no assertion.

---

## 5. What was not measured

- Field Web Vitals, INP, LCP. No field data exists for this branch.
- Long-task or render profiling of the notification panel.
- Database load under concurrent notification writes.
- Bundle size under Brotli (the build emits no Brotli artifacts).

None of these is claimed.
