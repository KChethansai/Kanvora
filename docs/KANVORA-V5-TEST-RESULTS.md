# Kanvora V5 — Test Results

Baseline `87df5956bfb2ec24e15ea67e37a30475cfac4a1f` → branch head
`feat/kanvora-v5-contract-closure` (`1447855` plus the documentation commit).

Every number below was produced by a command in this repository or against the
disposable live environment described in §5. Nothing here is estimated.

---

## 1. Suites

| Suite | Baseline | V5 | Command |
|-------|----------|----|---------|
| Frontend (vitest) | 62 files / 408 tests / 0 failed | **65 files / 456 tests / 0 failed** | `npm run test` in `Frontend/` |
| Frontend lint | exit 0 | **exit 0, zero errors** | `npm run lint` in `Frontend/` |
| Frontend production build | exit 0 | **exit 0** | `VITE_API_URL=… npm run build` |
| Backend unit | 64 pass / 0 fail | **64 pass / 0 fail** | `npm test` in `Backend/` |
| Backend integration (real replica set) | 109 pass / 0 fail / 0 skipped | **110 pass / 0 fail / 0 skipped** | `node --test tests/integration/*.test.js` against a disposable `MongoMemoryReplSet` |
| Route inventory | 71 / 70 | **71 / 70, same canonical hash** | `node scripts/routes.mjs` |
| Production dependencies | 0 vulnerabilities | **0 vulnerabilities** (frontend and backend) | `npm audit --omit=dev` |
| Tracked files | 275 | 278 (+3 new test files) | `git ls-files` |
| Secret scan | clean | **clean** | pattern scan over every tracked file |

Frontend dev dependencies report 2 moderate advisories inside `vitest`. They are
pre-existing at the baseline, are not in the production bundle, and no
dependency was added or upgraded on this branch.

---

## 2. Per-finding RED → GREEN evidence

A test that passed against the untouched source is recorded as a **guard**, not
as evidence of a defect. RED was produced by stashing only the source files and
re-running the same test file.

### V5-05 / V5-06 / V5-07 — notification overlay
`Frontend/src/tests/notification-mutation-reconciliation.test.js`

| Test | At baseline | After |
|------|-------------|-------|
| a held read does not resurrect a deleted notification | **RED** | pass |
| a refused delete restores the row | **RED** | pass |
| an accepted invite does not revert to pending | **RED** | pass |
| a rejected invite does not revert to pending | **RED** | pass |
| a read is not put back into unread after it was read | guard | pass |
| a read in flight when everything is marked read is discarded | guard | pass |
| reset clears deletion tombstones | guard | pass |
| the user room is re-entered after a reconnect | **RED** (review R-2) | pass |

The V4 version of the first test answered with an empty `payload`, so it could
only assert the case that already worked. It now answers with the snapshot that
still contains the deleted row — which is what an in-flight read actually
returns — and it fails against the untouched source.

### V5-01 — pagination and counts
`Frontend/src/tests/notification-pagination.test.js` — **10 RED, 1 guard**, plus
**4 RED** for the review corrections (R-1, R-3).

| Test | At baseline |
|------|-------------|
| asks for the first page with the server page size | RED |
| appends the next page without duplicating a row | RED |
| reports the account unread count when only one page is loaded | RED |
| does not ask for another page when everything is loaded | RED |
| stops paginating on an empty page past the end | RED |
| discards an append that resolves after page 1 was reloaded | RED |
| keeps the loaded page and clears the spinner when a page fails | RED |
| survives a response without the new totals instead of producing NaN | RED |
| counts a live delivery once and raises the account totals | RED |
| never reports a negative count after repeated removals | RED |
| lowers the count when a loaded unread row is marked read | guard |
| does not strand the control when everything is marked read mid-append | **RED** (R-1) |
| does not strand the spinner when a failed reload supersedes an append | **RED** (R-1) |
| stops promising an exact number of remaining rows after a delete | **RED** (R-3) |
| re-aligns the window when the first page is read again | **RED** (R-3) |

`Frontend/src/tests/notification-panel.test.jsx` — 12 tests over the rendered
panel: control visibility and disabled state, label arithmetic, the account
totals in the tabs, the disclosure line in both the populated and the empty
state, no badge on the invites tab, and the label after a shifted window. These
assert new capability, so they are coverage rather than regression evidence.

`Backend/tests/integration/notification-security.test.js` — one new test:
60 rows for one recipient, page 1 holds 50, page 2 holds the remaining 10, both
report `total: 60` and `unreadCount: 40`, no row appears on both pages, a page
past the end returns an empty payload with the same totals, a second recipient
sees `total: 0`, and four rows sharing one timestamp still have a total order
across pages.

`Backend/tests/baseline.test.js` — rewritten. It previously compared the live
inventory against the stale B0 document plus a hardcoded list of additions, so
it could not fail when the document rotted. It now asserts the inventory
matches `docs/api-baseline.json` exactly, including counts, ordering and the
canonical hash, and that the retired legacy surfaces stay retired by path **and**
by source file.

### V5-02 — checklist validation
`Frontend/src/tests/checklist-validation.test.jsx` — **4 RED**, plus
`card-save-payload.test.js` (**4 RED**) and
`card-editor-save-payload.test.jsx` (**1 RED**).

| Test | At baseline |
|------|-------------|
| marks a blank title invalid and withholds the request | RED |
| clears the error and resumes saving once the title is valid | RED |
| withholds an edit to a different checklist while any title is blank | RED |
| withholds adding an item while a title is blank but keeps the typed item | RED |
| rejects a whitespace title on a checklist that has items | RED |
| rejects a whitespace title on an itemless checklist | RED |
| reports the first invalid checklist | RED |
| refuses to save a card whose checklist title is blank | RED |
| accepts a named checklist and an empty list | guard |
| does not render an error for a card with no checklists | guard |

The itemless case is the one that loses data: the editor filtered an itemless
blank checklist out of the payload, which `$set`s the array without it.

`Backend/tests/integration/project-security.test.js` — three whitespace-title
payloads added to the existing invalid-payload loop (`"   "` with items,
`"   "` without items, `"\n\t "` with items), plus an assertion that the stored
card is unchanged after the rejections. The server was not changed; this pins
the behaviour the client now depends on.

### V5-03 — board activity scoping
`Frontend/src/tests/board-room-admission.test.js` — **2 RED, 2 guards**

| Test | At baseline |
|------|-------------|
| drops activity for another board | RED |
| drops activity that cannot be addressed to a board | RED |
| accepts activity that belongs to this board | guard |
| compares the board id by value | guard |

### V5-04 — provenance (no production change)
`Frontend/src/tests/card-creation-provenance.test.js` — 2 new guards:
a read that started before the session reset is discarded afterwards, and a
creation from before the reset is not retained.

These were **injection-tested**: rewinding `nextCardFetchGeneration` inside
`resetCardFetches()` makes the first one fail, so the guard is real and not a
tautology. The source was restored immediately afterwards and the working tree
was verified clean.

### Injection tests for the review corrections

Each fix was reverted in turn and the corresponding test observed to fail:

| Reverted fix | Test that failed |
|--------------|------------------|
| `markAllRead` no longer clears `loadingMore` | does not strand the load-older control when everything is marked read mid-append |
| the failure path no longer clears both flags | does not strand the spinner when a failed reload supersedes an append |
| the delete no longer marks the window approximate | stops promising an exact number of remaining rows after a delete; re-aligns the window when the first page is read again |
| the reconnect listener is not registered | the user room is re-entered after a reconnect |

The source was restored after each injection and the tree verified clean.

---

## 3. Live browser matrix

Real MongoDB replica set, real backend, real Socket.IO, real Vite dev server,
two independent browser contexts with real cookie sessions. No production data.
The same matrix was run against the baseline worktree and against this branch.

**Baseline 28/47 — V5 49/49.** Two S7 checks are conditional on the control
existing, which is why the baseline denominator is 47.

| # | Scenario | Baseline | V5 |
|---|----------|----------|-----|
| S1 | "All" tab reports the account total | FAIL (`All 30`) | PASS (`All 60`) |
| S1 | "Unread" tab reports the account unread total | FAIL (`Unread 0`) | PASS (`Unread 20`) |
| S1 | first page holds the server page size | FAIL (30 rows) | PASS (50 rows) |
| S1 | "Load older" offers the remaining rows | FAIL (absent) | PASS (`Load older — 10 more`) |
| S1 | unread tab discloses rows beyond the loaded page | FAIL | PASS |
| S1 | the control disappears when everything is loaded | FAIL | PASS |
| S1 | the disclosure disappears with it | FAIL | PASS |
| S1 | load older appends the second page | FAIL (30) | PASS (60) |
| S2 | invite accepted by the server | PASS (201) | PASS (201) |
| S2 | a real socket delivery reaches an open panel | FAIL (no total) | PASS (`total 61`) |
| S2 | the live delivery raises the account total | FAIL (`All 31`) | PASS (`All 61`) |
| S3 | a held read does not resurrect a deleted notification | **FAIL** | **PASS** |
| S3 | the server really deleted it | PASS | PASS |
| S4 | the member creates a card through the API | PASS (201) | PASS (201) |
| S4 | a peer card appears live in the other browser | PASS | PASS |
| S4 | a card is created while the other browser is disconnected | PASS (201) | PASS (201) |
| S4 | the board reconciles the change after reconnecting | PASS | PASS |
| S4 | the board room is re-entered after reconnecting | PASS | PASS |
| S5 | no card write is sent while the title is blank | **FAIL (1 PUT)** | **PASS (0 PUTs)** |
| S5 | the editor explains the blank title inline | FAIL | PASS |
| S5 | the save is refused with a named reason | FAIL | PASS |
| S5 | the refused save sent nothing | **FAIL (2 PUTs)** | **PASS (0 PUTs)** |
| S5 | the draft is preserved exactly as typed | PASS | PASS |
| S5 | a valid title resumes the write | PASS | PASS |
| S6 | the member sees only their own notifications | PASS | PASS |
| S6 | switching accounts replaces the list | PASS | PASS |
| S6 | the switched account keeps its own total | FAIL (field absent) | PASS (`total 60`) |
| S7 | no axe violation on the notification panel | PASS | PASS (0 of any impact) |
| S7 | the load-older control exists for a full account | FAIL | PASS |
| S7 | the load-older control can hold focus | not reached | PASS |
| S7 | Enter on the control loads the next page | not reached | PASS (50 → 60) |
| S7 | the invalid checklist field is marked invalid | FAIL (`null`) | PASS (`true`) |
| S7 | the error is programmatically associated with the field | FAIL | PASS (`role=alert`, `aria-describedby` resolves) |
| S7 | no axe violation on the card editor with an invalid checklist | PASS | PASS (0 of any impact) |
| S8 | notifications has no horizontal overflow at 360px | PASS | PASS (0px) |
| S8 | notifications keeps the control inside the viewport at 360px | PASS | PASS (69×29) |
| S8 | board has no horizontal overflow at 360px | PASS | PASS (0px) |
| S8 | notifications has no horizontal overflow at 768px | PASS | PASS (0px) |
| S8 | notifications keeps the control inside the viewport at 768px | PASS | PASS (69×29) |
| S8 | board has no horizontal overflow at 768px | PASS | PASS (0px) |
| S8 | notifications has no horizontal overflow at 1280px | PASS | PASS (0px) |
| S8 | notifications keeps the control inside the viewport at 1280px | PASS | PASS (69×29) |
| S8 | board has no horizontal overflow at 1280px | PASS | PASS (0px) |
| — | no unexpected console errors | PASS | PASS |

How S3 is produced honestly: the real `GET /notifications` is performed, so the
server's snapshot is taken *before* the delete, and only the delivery of that
real response is held. The payload is not fabricated. The deleted row is then
removed through the live store, the held response is released, and the row's
presence is read back from the store. At baseline the row is present again; on
this branch it is not. The server-side deletion is separately confirmed with a
fresh authenticated `GET`.

The S4 reconnect step closes the socket transport, creates a card through the
API from the other session, waits for the client's own reconnect, and then waits
for the board to reconcile. It passes at baseline and on this branch, which is
the regression evidence that V2/V3 collaboration behaviour is intact. The live
peer-event assertion waits for the server's presence broadcast before creating
the card, so it measures the handler rather than how fast the room join happened
to be.

S8 is a **reduced** geometry check — horizontal overflow and control containment
at three widths on the two screens V5 touched. It is not the V4 486-check
matrix, which came from disposable tooling that is not reproduced here.

---

## 4. Gates

| Gate | Result |
|------|--------|
| Frontend tests pass | pass — 456/456 |
| ESLint zero errors | pass |
| Production build succeeds | pass |
| Backend unit suite passes | pass — 64/64 |
| Backend real integration suite passes | pass — 110/110, 0 skipped |
| No unapproved route / payload / status-code change | pass — 71/70, same canonical hash; one additive field pair |
| Secret scan | pass |
| Dependency scan | pass — 0 production vulnerabilities in both packages |
| Browser geometry checks remain green | pass for a **reduced** check on the two changed screens (§3 S8); the full V4 486-check matrix was not reproduced |
| No new serious or critical axe violations | pass — 0 violations of any impact on both scanned pages |
| Theme, focus and keyboard contracts intact | pass for the new controls (focus + Enter verified live, 456 unit tests include the existing contrast suites); the full V4 theme matrix was not re-run |
| No unexplained performance regression > 10% | pass — see `KANVORA-V5-PERFORMANCE.md` |
| Independent review identifies no unresolved P0/P1 | pass — see `KANVORA-V5-FINAL-REPORT.md` |

Static analysis: **not run**. Neither Semgrep nor CodeQL is installed in this
environment, so no SAST result is claimed.

---

## 5. Environment for the live run

- MongoDB: `mongodb-memory-server` 11.3.0 with the cached `mongod` 8.2.6, single
  node replica set, random database name.
- Backend: `node server.js` with a synthetic `SECRET_KEY`, blank SMTP,
  Cloudinary and Google credentials, `CLIENT_URL` pointed at the dev server.
- Frontend: `vite` dev server, `VITE_API_URL` pointed at the backend.
- Browser: Playwright 1.64.1, Chromium 156.0.8078.4, two isolated contexts.
- axe-core 4.10.2 injected into the live page, WCAG 2.0/2.1 A and AA tags.
- Everything above lives under `/home/chethan/.tmp/opencode/kanvora-v5/` and is
  not committed.
