# UIX V2 count reconciliation

This documentation-only correction does not change the released UI.

Comparison: pre-V2 `a4c68dc6090543cc41cb723044918e172a7a8104` to V2
`a08046c33baa9326e097a3bfaee6aff3433466d4`.

| Quantity | Verified value | Evidence |
|---|---|---|
| Removed `common.js` exports | **98** | `git show <sha>:Frontend/src/Styles/common.js` contains 229 export declarations before and 131 after. Earlier 111 claim is not the shipped count. |
| Retired unique bridge class tokens | **22** | `verify-bridge-retirement.mjs`: 98 before, 76 after; all 22 have no remaining whole-class consumers. Earlier 20 claim is not the shipped count. |
| Geometry matrix | **486 = 27 routes × 2 themes × 9 widths** | Executable V2 `harness.mjs` has 27 route entries. “23 routes × 2 × 9 = 486” in the prior ledger is incorrect; 23 × 2 × 9 is 414. |
| Frontend release tests | **365 in 51 files** | V2 ledger; freshly reproduced V3 baseline logs. Earlier 320/42 describes an earlier baseline, not the release. |

The 11 high-risk tokens named by `themed-state-cascade.test.js` are a targeted
regression subset, not the exhaustive retirement inventory. Raw-hex occurrence
counts, unique bridge tokens and selector occurrences are different quantities.

V2 source planning files remain historical artifacts outside the repository;
this versioned note resolves their discrepancies without rewriting that history.
