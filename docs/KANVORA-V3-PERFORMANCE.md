# Kanvora V3 performance measurements

## Method and environment

Linux, Node 24.19.0, Chromium headless, 1280×900, local Vite production previews.
Exact V2 source was exported from `a08046c` outside the repository and built
with the same `VITE_API_URL=https://api.kanvora.example` / blank Google client
setting as final application commit `4d9714f`. Production API traffic in these
measurements is intercepted with explicit synthetic fixtures; this is **not**
live backend latency or persistence evidence.

Harness: `/home/chethan/.tmp/opencode/kanvora-v3-tools/performance.mjs`.
Reports: `performance-baseline.json`, `performance-final.json` in that folder.
Three fresh-context samples per board size; five warm SPA round trips per
sample. Each transition waits for its destination heading/card, not a guessed
delay. Warm transitions use history/popstate to isolate route work, not a
claim of human click-path testing. The browser workflows are reported separately.

Early runs exposed harness problems (unconfigured preview, missing route
readiness), and a concurrent Lighthouse/axe/geometry workload distorted
timings. Those exploratory results are not the certified comparison. The
reported pair was rerun sequentially after heavy jobs completed. No application
optimization was made or credited for warm-machine timing differences.

## Production assets and route transfer

| Metric | V2 baseline | V3 final | Change |
|---|---:|---:|---:|
| All route JS, deterministic gzip bytes | 255,602 | 255,675 | +73 (+0.029%) |
| All CSS, deterministic gzip bytes | 18,444 | 18,444 | 0 |
| Cold board JS/CSS resource transfer bytes, including headers | 211,660 | 211,702 | +42 (+0.020%) |
| Cold board encoded body bytes | 208,960 | 209,002 | +42 |
| Cold board JS/CSS resource entries | 9 | 9 | 0 |

Aggregate gzip totals are not confused with a single route's actual transfer.
Cold board loading requests lazy board assets; visiting the dashboard afterward
adds `MainPage`, `Sidebar` and `Navbar` chunks in both versions. Returning to the
already-loaded board reuses those modules. Full resource entries and hashed
chunk names are retained in the JSON reports. No runtime dependency changed.

## Board workload (milliseconds)

| Fixture | Measurement | Baseline median | Final median | Change |
|---|---|---:|---:|---:|
| 1 card / 3 lists | Cold board ready, 3 samples | 502.88 | 379.76 | −24.5% |
| 1 card / 3 lists | Warm navigation, 15 samples | 194.37 | 125.81 | −35.3% |
| 600 cards / 3 lists, all cards in first list | Cold board ready, 3 samples | 908.49 | 876.75 | −3.49% |
| Same 600-card fixture | Warm navigation, 15 samples | 565.54 | 542.34 | −4.10% |

No unexplained >10% regression appears in this controlled pair. Small-sample
improvements are not attributed to the correctness fixes. This is a defined
600-card workload, not a guarantee for arbitrarily large boards. No
virtualization or `content-visibility: auto` was added.

## Render subscriptions, listeners and memory

- Fresh React Profiler regression tests verify **0 Navbar commits** for an
  unrelated project-list change and **0 Sidebar commits** for view-mode change;
  Sidebar still commits when its displayed project list changes. These are
  jsdom component measurements, not production-browser React timings.
- After five SPA round trips and forced GC, median 600-card used JS heap:
  **20,465,304 → 20,468,776 bytes** (+0.017%). DOM/listener counters are in the
  reports. Stable fixture size and small samples do not prove absence of every
  memory leak.
- Observed final listener counts vary within 175–180 (small fixture) and
  are 1373 in all three 600-card samples, without a demonstrated accumulating trend.
- Separately, the real development backend/browser session was navigated through
  **five same-document SPA board/dashboard cycles**. `connect`, `card-created`,
  `card-updated`, `list-created`, and `lists-reordered` each had exactly **one**
  registered Socket.IO listener at every sample. Full-page reloads were not
  substituted for that observation. Other event types and long-duration soak
  behavior remain outside that limited measurement.
- Production benchmark samples recorded **no page errors**. Expected fixture
  socket/auth noise is not a live-socket health assertion.

## Lighthouse laboratory run

Lighthouse **13.5.0**, public homepage only, default mobile form factor with
simulated throttling. Baseline/final run sequentially on local previews:

| Metric | Baseline | Final |
|---|---:|---:|
| Performance score | 87 | 86 |
| LCP | 2034.428 ms | 2130.179 ms (+4.71%) |
| CLS | 0 | 0 |
| TBT | 430 ms | 426 ms |

Both reports warn that the host CPU is slower than Lighthouse expects. Single
lab scores are noisy, not field outcomes or an authenticated-app performance
SLA. The early concurrent score of 43 was superseded after removing competing
audit workloads; it is not hidden as a product optimization. Reports:
`lighthouse-baseline.json`, `lighthouse-final.json` in the evidence folder.

**INP and field Web Vitals: NOT VERIFIED.** No CrUX/RUM source was available.

## Geometry and browser warnings

Original fixed-delay matrix: baseline 486 cases with 3 readiness misses; final
486 cases with 2 readiness misses. Both had zero document overflow, execution
errors and unexpected console-error groups. All five missed readiness probes
then passed a targeted semantic-wait rerun with zero overflow
(`geometry/retries.json`).

The complete final matrix was then rerun with the semantic wait instead of a
fixed delay, against the final production build:

| Matrix | Checks | Readiness failures | Horizontal overflow | Execution errors | Unexpected console-error groups |
|---|---:|---:|---:|---:|---:|
| Certified final (semantic wait) | 486 | **0** | **0** | **0** | **0** |

27 routes × 2 themes × 9 widths. Evidence:
`geometry/certified-matrix.json`, `v3-geometry-certified.log`. The earlier
fixed-delay misses remain recorded above; they are not erased, and no retry is
represented as a first-attempt pass. The persisted-preference contract holds
in this run: the public shell keeps `data-theme-scope="light"` while the
document preference stays `dark`, the app shell has no light scope, and a
client-side navigation re-scopes without a reload.
