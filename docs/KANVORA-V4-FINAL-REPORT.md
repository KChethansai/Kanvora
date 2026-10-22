# Kanvora V4 — final report

**Mission:** harden Kanvora's real-time collaboration, permissions,
asynchronous state handling and multi-user reliability.
**Baseline:** `a08046c33baa9326e097a3bfaee6aff3433466d4` (the released V3
build).
**Tested implementation:** `26e747f388a032d0cd20b29abc6860c196d4c68a`.
**Branch:** `feat/kanvora-v4-collaboration`.
**Deployment: none.** This workflow does not deploy.

The merge commit cannot contain its own SHA, so the final released SHA, the
pull request and both CI runs are recorded in the pull request's release
receipt comment and in
`/home/chethan/.tmp/opencode/kanvora-v4-tools/release-receipt.json`. This
report pins the tested implementation.

---

## 1. What was wrong, and what was done

Eight defects were **confirmed in a browser** and fixed. Two more were found by
the independent review of the change itself and fixed before the release. No
P0 was found. No backend, dependency, contract, permission, schema, theme or
drag-sensor change was made.

| ID | Severity | Defect | Fix | Commit |
|---|---|---|---|---|
| V4-01 | P1 | The board joined its socket room only after the initial reads, so a peer change made during the load was lost until a reload. | Join the room before the reads. | `42a1ab8` |
| V4-02 | P1 | An in-flight card read replaced the collection and deleted a card another member had just created. | Card-creation provenance, mirroring the protection the list path already had. | `04c6ab8` |
| V4-03 | P1 | The card editor submitted the whole form, so two members editing the same card overwrote each other. | Send only the fields that changed. | `9e0dc86` |
| V4-04 | P1 | The client never learned that its own access changed: it kept an editable board the server refused to write to. | Revalidate the board when the server closes the socket. | `e12a17f` |
| V4-05 | P1 | A notification read in flight replaced the collection and wiped a live delivery. | Request generation, live-delivery provenance, de-duplication, recomputed count. | `af26c22` |
| V4-10 | P2 | A failed card read was swallowed; a broken board looked like an empty one. | Classify and report the failure, with a retry. | `ec1aa63` |
| V4-08 | P2 | Every failure produced the same message. | One classifier; the card write path uses it. | `6a6671f` |
| V4-11 | P1 | *(found by the independent review)* A deleted notification was resurrected by a read in flight. | A deletion forgets the notification. | `26e747f` |
| V4-12 | P2 | *(found by the independent review)* A read state was undone by a read in flight. | The local read state wins over an older response. | `26e747f` |

The full evidence, with the before/after of each reproduction, is in
`KANVORA-V4-CONCURRENCY-RESULTS.md` and `KANVORA-V4-FIX-LEDGER.md`.

## 2. Multi-user evidence

Real Express backend, real Socket.IO server, a disposable MongoDB 8.2.6
replica set **outside** the repository, and two or more **independent
Playwright browser contexts**. No API call was mocked and no socket frame was
synthesised; the application's own mailed verification and invitation links
were used, so the real account and membership paths were exercised.

- **Matrix: 38 assertions, 0 failures, 2 not verified.**
- **Targeted reproductions: 11 assertions, 0 failures.**
- Two-browser synchronisation of lists, cards, titles, moves and deletions:
  **PASS**.
- Concurrent editing: A's title now survives B's save, and the two saves
  carry `title+description` and `description` only: **PASS**.
- Reconnection: a change made while a client was offline arrives on
  reconnect, and the socket holds exactly one application listener per event:
  **PASS**.
- Permission revocation: the demoted client shows a **View-only** badge and
  offers **no** control the server refuses, while the server still refuses the
  write: **PASS**.
- Session expiry: the other session is refused with 401 and the revoked
  client stops presenting the board and offers a way back: **PASS**.
- Stale responses: a held read does not override the current selection and
  does not repopulate a board that was left: **PASS**.
- Notification state: no duplicate, a stable count across a reload, and the
  count follows a read: **PASS**.
- Filter change during a drag: the card is in exactly one list, and the server
  agrees: **PASS**.
- Failed write rollback: the injected 503 is reported and the board recovers:
  **PASS**.
- Isolation: an outsider gets 404 and no board data in the DOM; a viewer can
  read but not write: **PASS**.

## 3. Test and gate results

| Gate | Result |
|---|---|
| Frontend tests | **62 files, 408 tests, 0 failures** (baseline 53 / 373) |
| Frontend ESLint | exit 0, zero errors |
| Production build | exit 0, `VITE_API_URL=https://api.kanvora.example` |
| Backend unit | **64 passed, 0 failed** |
| Backend integration (real replica set) | **109 passed, 0 failed, 0 skipped** |
| Backend syntax | exit 0 |
| Route inventory | **71 definitions / 70 API definitions**, byte-identical to the baseline (SHA-256 `71f6098b6451139df77900738e56409046a22b68aca81c7f32562425f7ec937e`) |
| Backend tree and manifests | unchanged |
| Secret scan | clean over **266 tracked files** |
| Semgrep OSS | 4 approved rulesets, 173 files (131 JavaScript), no partial/failed/skipped scan, 10 retained findings, **none from a V4 file** |
| axe-core 4.10.2 | **42 route/theme combinations, no violations** (baseline: no violations) |
| Geometry matrix | **486 checks, 0 readiness failures, 0 overflows, 0 execution errors, 0 unexpected console-error groups** (baseline: identical) |
| Multi-user matrix | 38 assertions, 0 failures, 2 not verified |
| Independent review | 3 independent read-only reviewers: concurrency **APPROVE WITH CHANGES** (all changes applied), security **CLEAN**, test coverage **9 genuine regression tests named, every weak test rewritten** |

## 4. Performance, before and after

Compared against a **fresh** baseline: the released V3 build exported from
Git, built with the same configuration and measured by the same harness.
Three alternating runs of each build; medians over 9 samples per measurement.

| Metric | Baseline | V4 final | Change |
|---|---:|---:|---:|
| Gzip JS | 255,602 B | 257,132 B | **+0.60%** |
| Gzip CSS | 18,444 B | 18,444 B | 0 |
| Cold board transfer | 211,660 B | 213,174 B | +0.72% |
| 1 card, cold | 482.5 ms | 488.1 ms | +1.16% |
| 1 card, warm | 175.8 ms | 175.6 ms | −0.12% |
| 600 cards, cold | 1,174.4 ms | 1,192.3 ms | +1.52% |
| 600 cards, warm | 739.3 ms | 736.0 ms | −0.46% |
| Socket listeners (1 card / 600 cards) | 175 / 1,373 | 175 / 1,373 | unchanged |
| Used heap (600 cards) | 20,469,500 B | 20,488,740 B | +0.09% |

**No unexplained regression above 10%.** One earlier pair reported +10.36% on
the 1-card cold board; it was not reproducible, it was taken while other
browser jobs were still running, and the alternating runs supersede it. The
superseded numbers are disclosed in `KANVORA-V4-PERFORMANCE.md` rather than
deleted.

Lighthouse on this host is **bimodal for both builds** (the same build
alternates between ≈0.90/2.03 s and ≈0.65/7.29 s, and the baseline shows the
slow mode in two of three runs), so a single Lighthouse pair is not a usable
comparator here. The deterministic harness is the comparison of record.

## 5. Explicitly NOT VERIFIED

- **Native screen-reader output** (NVDA / VoiceOver / TalkBack). No assistive
  technology was available; the accessibility evidence is automated.
- **Physical mobile hardware.** Touch was emulated and is reported as
  emulation.
- **Native browser zoom at 125 / 150 / 200 %.** The persistent-profile zoom
  attempt did not change the device pixel ratio, so no zoom claim is made.
- **A list deleted in one browser disappearing in the other** (C1.8): the
  list-actions menu exposed no delete control.
- **The cause of an expired session being named** in the board-unavailable
  message (C8.5): the access loss is communicated and recoverable, the cause
  is not named.
- **Recovery email delivery and Cloudinary storage** — both need external
  services. The negative paths were tested; delivery is not claimed.
- **INP and field Web Vitals** — no field or RUM source is available.
- **Semgrep Pro and CodeQL** — Pro needs the proprietary engine and a login;
  CodeQL is not installed. OSS rulesets are not cross-file analysis.
- **A long-duration memory soak.**

Four pre-existing sibling defects were found and are recorded rather than
fixed, because each needs a backend contract change or a product decision:
the unpaginated notification read against the server's 30-item page cap, a
whitespace checklist title the server rejects, the unscoped
`activity-created` event, and the growth of the local provenance maps. They
are listed in `KANVORA-V4-CONCURRENCY-RESULTS.md` §5.

## 6. Release

The release record — the final merge SHA, the pull request, both CI run ids
with every job conclusion, and the confirmation that local `main`,
`origin/main` and GitHub `main` refer to the same commit — is posted as the
pull request's release receipt and written to
`/home/chethan/.tmp/opencode/kanvora-v4-tools/release-receipt.json`, because
a merge commit cannot contain its own SHA.

The release procedure was the same one the V3 release used: branch from the
verified baseline, push, open a pull request, **wait for green PR CI**, merge
normally, **observe the `main` CI on the merge SHA**, and verify the three
`main` references agree. No force push, no history rewrite, no bypassed check,
no deployment.
