# Kanvora V4 — performance

Every number here compares the **V4 implementation** against a **fresh V4
baseline**: the released V3 build `a08046c33baa9326e097a3bfaee6aff3433466d4`
exported from Git, built with the same configuration, and served by the same
harness. No historical V2 or V3 run is used as the comparison.

| | |
|---|---|
| Baseline | `a08046c` (released V3), exported with `git archive`, built with `VITE_API_URL=https://api.kanvora.example` and a blank Google client id |
| Final | the V4 tree, same configuration |
| Environment | Linux, Node 24.19.0, Chromium headless (the Playwright binary already on the machine), 1280×900 |
| Harness | `/home/chethan/.tmp/opencode/kanvora-v4-tools/performance.mjs` (the V3 harness, unchanged, pointed at the V4 baseline) |
| Method | 3 alternating runs of each build; every run takes 3 fresh-context samples per board size and 5 warm SPA round trips per sample. The medians below are over **9 samples per measurement**. |
| Raw reports | `performance-baseline.json`, `performance-final.json`, `perf-acc-*.json` |

The board data is served from explicit synthetic fixtures. These are **not**
live backend latency or persistence measurements; the live behaviour is
measured separately in `KANVORA-V4-CONCURRENCY-RESULTS.md`.

---

## 1. Production assets and transfer

| Metric | Baseline | V4 final | Change |
|---|---:|---:|---:|
| All route JS, deterministic gzip bytes | 255,602 | 257,132 | +1,530 (**+0.60%**) |
| All CSS, deterministic gzip bytes | 18,444 | 18,444 | 0 |
| Cold board JS/CSS transfer bytes (incl. headers) | 211,660 | 213,174 | +1,514 (**+0.72%**) |
| Cold board JS/CSS resource entries | 9 | 9 | 0 |

The growth is the two new utilities (`cardSavePayload`, `requestError`) and
the store changes. No dependency was added and no chunk was removed.

## 2. Board workload (milliseconds, median of 9 samples)

| Fixture | Measurement | Baseline | V4 final | Change |
|---|---|---:|---:|---:|
| 1 card / 2 lists | Cold board ready | 482.5 | 488.1 | +1.16% |
| 1 card / 2 lists | Warm navigation | 175.8 | 175.6 | −0.12% |
| 600 cards / 2 lists | Cold board ready | 1,174.4 | 1,192.3 | +1.52% |
| 600 cards / 2 lists | Warm navigation | 739.3 | 736.0 | −0.46% |

**No unexplained regression above 10%.** The largest change is +1.5%.

### A measurement that was superseded, and why

An earlier pair of runs reported the 1-card cold board at **+10.36%**. That
pair was taken while the geometry and axe jobs were still finishing, and it
was not reproducible: the same build measured −5.8% in a later run. Three
**alternating** runs of each build (baseline, final, baseline, final, …) with
nothing else running produce the medians above. The superseded numbers are
disclosed here rather than deleted; the alternating runs are the comparison of
record, because a single pair cannot separate a change from contention.

## 3. Re-render counts, listeners and memory

| Measurement | Baseline | V4 final |
|---|---|---|
| Application socket listeners after navigation (1 card) | 175 | 175 |
| Application socket listeners after navigation (600 cards) | 1,373 | 1,373 |
| Observed listener spread over 9 samples (1 card) | 175–179 | 175–179 |
| Observed listener spread over 9 samples (600 cards) | 1,373–1,378 | 1,373–1,378 |
| Used JS heap after forced GC (1 card) | 5,297,272 B | 5,312,952 B (+0.30%) |
| Used JS heap after forced GC (600 cards) | 20,469,500 B | 20,488,740 B (+0.09%) |

- The **store subscription guards** are unchanged and still pass:
  `Frontend/src/tests/store-subscription-renders.test.jsx` asserts **0** Navbar
  commits for an unrelated project-list change and **0** Sidebar commits for a
  view-mode change, while the Sidebar still commits when the project list it
  shows changes.
- The **reconnect** path was measured live: after a transport drop and a
  reconnect, the application holds exactly **one** listener per socket event
  (`card-created 1, card-updated 1, list-created 1, lists-reordered 1,
  new-notification 1`).
- The **board-load order changed** (the room is joined before the reads), so
  the board issues the same reads as before and one socket join earlier. The
  request count per board open is unchanged; the read/join interleaving is
  not.
- The sample counts are small. They show no accumulating trend, which is not
  the same as proving the absence of every leak.

## 4. Lighthouse (laboratory, single page)

Lighthouse 13.5.0, public homepage, default mobile form factor with simulated
throttling. Three runs per build, alternating.

| | Baseline runs | V4 final runs |
|---|---|---|
| Performance score | 0.65, 0.66, 0.91 | 0.90, 0.65, 0.65 |
| LCP (ms) | 7293.5, 7292.1, 2035.7 | 2022.7, 7285.7, 7293.9 |
| CLS | 0, 0, 0 | 0, 0, 0 |
| TBT (ms) | 385, 350, 317 | 330, 376, 403 |

**Lighthouse is bimodal on this host, for both builds.** The same build
alternates between a fast run (score ≈0.90, LCP ≈2.03 s) and a slow run (score
≈0.65, LCP ≈7.29 s), and the baseline shows the slow mode in two of its three
runs. The slow mode is therefore an environment stall, not a change in the
application: it appears identically in the baseline.

Comparing the runs that are not stalls, the pair is 0.91 → 0.90 with LCP
2035.7 ms → 2022.7 ms. Both reports carry the usual "the tested device
appears to have a slower CPU than Lighthouse expects" warning.

**This makes the single Lighthouse pair unusable as a comparator on this
host.** The deterministic harness in §2 is the comparison of record.

## 5. Browser geometry and accessibility

| Check | Baseline | V4 final |
|---|---|---|
| Geometry matrix (27 routes × 2 themes × 9 widths) | 486 checks, 0 readiness failures, 0 horizontal overflows, 0 execution errors, 0 unexpected console-error groups | **486 checks, 0, 0, 0, 0** |
| axe-core 4.10.2 (42 route/theme combinations) | no violations | **no violations** |

The final matrix ran with the semantic wait (a page assertion) rather than a
fixed delay. The earlier fixed-delay matrices and their readiness misses are
recorded in the V3 performance report; this run had none.

## 6. What was not measured

- **INP and field Web Vitals** — no RUM or CrUX source is available.
- **Real user load** — the fixtures are synthetic and the backend is local.
- **Physical mobile hardware** — touch was emulated.
- **Native browser zoom at 125 / 150 / 200 %** — the persistent-profile zoom
  attempt did not change the device pixel ratio, so no zoom claim is made.
- **Memory over a long soak** — the runs are minutes long, not hours.
