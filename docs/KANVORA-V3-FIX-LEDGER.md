# Kanvora V3 fix ledger

No runtime dependencies, backend routes, theme tokens, drag sensors, permission
rules, upload controls or architecture were changed.

| ID | Severity / commit | Root cause and correction | Regression evidence |
|---|---|---|---|
| V3-01 | P1 / `348f705` | Recent-project reads only checked account identity. A response started before deletion could reinsert the deleted recent project. Added a recent-read generation invalidated by mutations/reset and newer requests. | RED: one failed, seven passed; deleted project unexpectedly restored. GREEN: eight board-fetch tests pass. Independent reviewer approved. |
| V3-02 | P1 / `63a6a19` | Pending workspace detail could reselect a deleted or previously active workspace. Added detail generations invalidated by selection/reset/successful workspace mutation. | RED: delete and selection race tests fail. Initial fix over-constrained project-driven selection; reviewer caught it. Two additional tests fail against that guard; guard removed. GREEN: four workspace race tests pass. |
| V3-04 | P1 / `f698fc3` | Drawers z-30 sat behind navbar z-40; normal clicks on close controls hit account menu. Raised only profile/notification roots to z-50. | RED: two source-layer assertions fail; real browser center hit is account menu. GREEN: both assertions pass; center hit is close button; normal clicks close both drawers to dashboard. |
| V3-05 | P1 / `4d9714f` | Follow-up variant: list-fetch generation existed but mutations did not invalidate it. A pending workspace listing restored a deleted workspace. Invalidate listing reads alongside detail reads and release the abandoned loading state. | RED: deferred listing restores deleted workspace. GREEN: five workspace race tests pass; independent review approved. |

Fresh combined targeted verification: **3 files / 15 tests passed**. Independent
tester also ran race, subscription-render, drag-persistence, role, access,
pagination and dialog suites: **9 files / 45 tests passed**. Final full-suite
counts are in the final report; targeted results are not substitutes.

Browser evidence: `/home/chethan/.tmp/opencode/v3-notification-close-blocked.png`,
`v3-drawers-close-fixed.png`, `v3-write-rollback.png`,
`kanvora-v3-tools/live-workflows.zip`. Store race tests use controlled deferred
Axios responses; they do not claim server-side persistence or a browser-level
reproduction of those exact timing windows. Live create/edit/drag reload checks
independently establish the tested persistence paths.

## Rejected / deferred work

- Three socket findings retracted after source showed every handler uses the
  session/epoch-guarded setter. No speculative socket rewrite.
- Missing explicit DnD announcements was not a defect: defaults announce moves.
- V3-03 analytics-cache stale-read candidate deferred: no demonstrated
  user-visible loss or measured optimization benefit.
- No virtualization, content-visibility, component-library migration or P3 work.
- Historical count correction is separate documentation commit `c5468ec`; see
  `KANVORA-UIX-V2-COUNTS.md` (98 exports, 22 bridge tokens, 27 geometry routes).
