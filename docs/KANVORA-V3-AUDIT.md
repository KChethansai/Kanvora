# Kanvora V3 audit

Baseline: `a08046c33baa9326e097a3bfaee6aff3433466d4`.
Branch: `feat/kanvora-v3-hardening`. Initial tree clean; origin is
`https://github.com/KChethansai/Kanvora.git`; GitHub main matches baseline.

## Initial findings ledger

| ID | Priority | Finding | Evidence / disposition |
|---|---|---|---|
| V3-01 | P1 resolved | In-flight recent-project read restores a deleted project | Deferred-response regression reproduced; generation invalidation fixed in `348f705`. |
| V3-02 | P1 resolved | In-flight workspace detail restores deleted workspace or stale active selection | Two race regressions reproduced; generation invalidation fixed in `63a6a19`, with two caller-contract guards added to tests. |
| V3-03 | P2 candidate, deferred | In-flight analytics may repopulate deleted project's cache entry | Source-only candidate; no demonstrated user-visible impact or measured benefit, so no speculative fix. |
| V3-04 | P1 resolved | Navbar intercepts notification/profile close buttons | Playwright: both close buttons at x1792,y16,28×28 hit account menu before; z-50 correction restores normal click/hit test in `f698fc3`. Before/after screenshots outside source tree. |
| V3-05 | P1 resolved | Workspace listing generation is not invalidated by mutations | Deferred-list regression restored a deleted workspace. Mutation/reset/selection invalidation plus loading release fixed in `4d9714f`; five workspace race tests pass. |
| V3-R1 | Rejected | Socket setters allegedly bypass session guard | Source inspection proves handlers call the guarded local setter; reviewer retracted all three related claims. No change. |
| V3-R2 | Rejected | Missing explicit DnD announcements allegedly means silence | Real keyboard interaction exposes dnd-kit's default drop announcement. Reviewer retracted P1 classification. Actual screen-reader output remains NOT VERIFIED. |

## Fresh evidence collected

- Frontend baseline: 51 files / 365 tests pass; lint exit 0; build exit 0.
- Backend baseline: 64 unit tests pass; syntax check exit 0.
- Route inventory: 71 definitions, 70 API definitions.
- Secret scan: no credential-shaped strings in 246 tracked files.
- Baseline GitHub main CI: run `39671001869`, completed successfully.
- Real ephemeral MongoDB replica set provisioned outside the repository.
  Integration suite: 109 tests passed, 0 failed, 0 skipped.
- Playwright MCP: registered a disposable account; confirmed unverified login
  rejection; marked only that synthetic account verified directly in the
  disposable database because SMTP is disabled; logged in; created workspace,
  project, two lists and one card; reloaded and confirmed persistence.
- Screenshot: `/home/chethan/.tmp/opencode/v3-live-board.png`.

## Limits

Release/CI status is recorded separately in the final report. No production
data or deployment is involved. SMTP, Cloudinary
and Google OAuth are not configured for the isolated test backend. Initial
browser errors include backend startup timing and Google origin rejection;
these are environment failures, not silently counted as application passes.

## Static analysis

User explicitly approved the scan plan. Isolated Semgrep OSS tooling ran
`p/javascript`, `p/security-audit`, `p/secrets` and applicable Trail of Bits
rules through the skill runner, telemetry disabled. All four scans completed:
no failed, skipped, partial or empty-coverage scan. Final shared scans covered 170
files; JavaScript scope covered 132. Pro was checked but unavailable without
the proprietary engine/login; CodeQL did not run. OSS is not cross-file Pro
analysis, and scan coverage is not a claim to inspect ignored/generated files.

JSON reports contain eight Trail of Bits warnings; merged SARIF retains two
additional suppressed results (ten total). Independent security triage found
no demonstrated P0/P1: local/CI Mongo URIs and CI port publication are
test-scoped; the Apollo CORS rule hits Socket.IO's explicit origin allowlist;
the retained bcrypt result is a synthetic timing-equalization hash; retained
email HTML interpolation escapes its values. No real credential is reproduced
in these reports. Deployments still must configure appropriate database TLS.

Evidence: `/home/chethan/.tmp/opencode/kanvora-v3-tools/semgrep/scans.json`,
`results/results.sarif`; SARIF levels were resolved through rule defaults when
not present on results. No unsupported “zero scanner findings” claim is made.

## Independent challenges

Functional/state, accessibility/responsive, backend/security, performance and
visual/theme reviewers were dispatched independently using GPT-6 Luna low.
Review outputs were challenged rather than accepted blindly: three socket
claims and the missing-announcement claim were retracted; a real caller
regression in the first workspace patch was corrected before commit. Fresh
independent tester evidence before the listing follow-up: 53 files / 372 tests
pass. The final author-run suite includes that regression: 53 files / 373 pass. Browser reviewer
independently closed both fixed drawers without force clicks. Theme review's
hold on readiness evidence is addressed by preserving original failures and
performing a complete semantic-wait matrix rerun, not by hiding them.

Native high zoom, actual AT/physical devices and external service delivery stay
explicitly NOT VERIFIED. See the workflow matrix and accessibility report.
