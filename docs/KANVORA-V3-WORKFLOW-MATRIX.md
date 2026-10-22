# Kanvora V3 workflow matrix

Environment: Chromium via Playwright MCP, local Vite frontend, real Express
backend and disposable MongoDB 8.2.6 replica set. No production data. Test
account `v3-audit@example.test`; SMTP, Google OAuth and Cloudinary disabled in
the isolated backend. Email verification was seeded directly for this one
synthetic account after registration; email delivery is not claimed.

Evidence root: `/home/chethan/.tmp/opencode/` (prefix `v3-`). Main-context
trace: `kanvora-v3-tools/live-workflows.zip`. Supplemental contexts are covered
by the named screenshots and tool observations, not necessarily that trace.

| Journey | Expected | Actual / status | Evidence |
|---|---|---|---|
| Register | Create unverified disposable account | PASS; redirected to login | MCP registration flow; backend real DB |
| Unverified login | Reject before verification | PASS; login remains unavailable until explicit fixture verification | MCP login flow |
| Login and reload | Authenticated board survives reload | PASS | `v3-live-board.png` |
| Logout / protected history | Logout returns public home; Back cannot reopen protected data | PASS; outsider fixture logged out, Back and direct dashboard navigation redirect to login | `v3-logout-protected.png` |
| Invalid credentials / recovery | Reject wrong password; allow valid retry | PASS; invalid-password message observed, valid retry reaches dashboard | MCP isolated-context flow |
| Protected redirect | Anonymous project request goes to login | PASS | MCP isolated-context flow |
| Actual TTL expiry / refresh rotation | Expired server session rejected, refresh behavior verified | NOT VERIFIED in browser; revocation/expiry covered separately by backend integration tests | `v3-integration.log` is API evidence, not a browser pass |
| Browser Back / Forward | Return between inbox and dashboard | PASS | Main MCP context |
| Password recovery form | Non-enumerating response and recoverable UI | PASS; HTTP 200 generic response | `v3-password-recovery.png` |
| Recovery email / complete reset | Deliver email and finish reset link | BLOCKED locally: SMTP disabled; API token lifecycle separately integration-tested | No email-delivery claim |
| Workspace create / switch | New workspace selected; original board reachable after switching back | PASS; created second disposable workspace, switched back | `v3-workspace-switch.png` |
| Workspace deletion confirmation | Cancel preserves workspace | PASS; inline “Yes, delete” / “Cancel”, canceled | Main-context trace |
| Project create / navigate | Open new board and persist it | PASS | `v3-live-board.png` |
| Project deletion confirmation | Cancel preserves board | PASS; native confirmation observed; dismissed; delete control and board remain | Main MCP context |
| Project edit | Change existing title via supported UI | NOT VERIFIED; no tested edit affordance | No inferred UI pass from store tests |
| Membership / roles / permission denied | Server enforces ownership and role ceilings | API integration PASS; isolated authenticated outsider sees “This board is not available” and HTTP 404; browser role-change workflow NOT VERIFIED | `v3-permission-denied.png`, `v3-integration.log`; owner members/settings screenshots |
| List/card create | Persist created lists and cards | PASS; two lists, card survives reload | `v3-live-board.png` |
| Card edits / labels | Save description and paired label | PASS after reload | Main-context trace |
| Assignment | Save selected workspace member | PASS; member count 1 and selected member survive reload | Main-context trace |
| Mouse cross-list move | Persist move, no card duplication | PASS after reload | `v3-mouse-drag-persisted.png` |
| Keyboard cross-list move | Space/arrows/drop, persist destination | PASS after reload; default DnD status announcement observed | `v3-keyboard-drag.png`, trace |
| Filtering during active drag | Preserve drag state across filter changes | NOT VERIFIED in browser; drag regression suite separately passes | No claim from a static geometry check |
| Failed-write rollback | Failed move restores original position and reports failure | PASS; intercepted exactly one PUT with 503; “Could not move card”, original list restored | `v3-write-rollback.png` |
| Duplicate-write prevention | Double submission creates one card | PASS; double-click produced one POST and one rendered card | Main MCP context |
| Templates / favourites | Create, favourite, reload, use independent copy | PASS; favourite persists; new board has three empty lanes after reload | `v3-template-favourite.png`, trace |
| Notifications | Empty filters and usable close | PASS; zero counts, empty message; close defect fixed and retested | `v3-drawers-close-fixed.png` |
| Notification read / live incoming update | Mark a real unread notification read | NOT VERIFIED in browser with empty fixture; API integration covered separately | Do not equate empty-state pass with read-state pass |
| Inbox / planner | Honest overview copy, valid navigation | PASS | `v3-route-_inbox.png`, `v3-route-_planner.png` |
| Attachments | Reject bad MIME; report service failure without losing card | PASS rejection/error handling; image storage/download BLOCKED without Cloudinary | `v3-upload-failure.png` |
| Search / command palette | Filter, empty result, keyboard navigate, Escape | PASS; announced empty state, Enter opens notifications, Escape closes | Main-context trace |
| Theme switching | Dark/light preference changes app, public remains light | PASS live palette dark/light; broader fixture matrix checks scope | Trace; geometry artifacts |
| Loading / empty / error | Recoverable informative states | PASS for observed initial loading, empty boards/notifications, failed moves/uploads | Named screenshots; not exhaustive all-error coverage |
| Two-browser socket synchronization | Remote member receives updates and revocation | API/socket integration PASS; two-browser UI synchronization NOT VERIFIED | `v3-integration.log` |

## Console and network accounting

- Initial auth check encountered connection refusal while the disposable backend
  was still starting; it was not counted as a product failure or a pass.
- Development frontend Google Identity requests produce origin-not-allowed / 403
  noise from the existing local frontend OAuth setting. Google sign-in is NOT
  VERIFIED; production-fixture builds explicitly omit that setting.
- Intentional 503 move failure and upload-service failure are expected negative
  test requests, retained as evidence rather than filtered into a clean run.
- UI-automation timeouts due to wrong selectors or probing before rendering
  were corrected and rerun; they are not fabricated application defects.
- See accessibility/performance reports for separate fixture-only browser
  coverage. Mocked geometry and axe results do not establish live persistence.
