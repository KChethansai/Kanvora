# Kanvora V3 accessibility and device verification

This is an evidence-limited audit, not WCAG certification.

## Native browser zoom

| Requested | Observed DPR / CSS width at 1280px window | Result |
|---|---|---|
| 100% | 1 / 1280 | PASS baseline layout |
| 125% | 1 / 1280 | NOT VERIFIED; native zoom did not change |
| 150% | 1 / 1280 | NOT VERIFIED; native zoom did not change |
| 200% | 1 / 1280 | NOT VERIFIED; native zoom did not change |

Chromium persistent-profile zoom preferences were attempted, but observed
metrics disprove successful control. These screenshots are **not** higher-zoom
evidence. No viewport resize, CSS zoom or mobile scale factor is called native
browser zoom. Evidence: `kanvora-v3-tools/zoom-results.json`, `zoom.mjs` and
`zoom-*.png`, all under `/home/chethan/.tmp/opencode/`.

Manual completion: open the authenticated app in desktop Chrome; reset with
Ctrl+0; use the browser menu's Zoom control to select 100, 125, 150 and 200%.
At each value inspect dashboard, board, card details, notification/profile
drawers and command palette; Tab through controls; verify focus, clipping,
text wrapping, document overflow and dialog scrolling. Record browser version,
OS display scale, menu zoom value and screenshots. Restore Ctrl+0 afterward.

## Forced colors

Playwright `forcedColors: active` was confirmed by `matchMedia` in Chromium.
Board buttons compute black text and system-white fills; the board has no
document overflow. Screenshot: `v3-forced-colors-board.png`. Default drag
status messages and named handles expose movement beyond color alone.
This is emulation, not a physical Windows high-contrast session. Exhaustive
forced-colors verification of all nav, badge, dialog and drag-indicator states
remains NOT VERIFIED; the single board observation is not generalized.

## Touch emulation

- 390×844 phone and 768×1024 tablet contexts: `hasTouch`, `isMobile`, observed
  `navigator.maxTouchPoints = 1`. Card dialog opens/closes by tap and fits the
  viewport without document overflow (`v3-touch-390.png`, `v3-touch-768.png`).
- Tablet CDP touch start/move/end on the explicit drag handle moved the card
  cross-list; reload retained the destination (`v3-touch-drag-persisted.png`).
- A preliminary small-target query ran while the dialog was animating. It is
  not a validated target-size violation: transformed dimensions, inline-target
  exceptions and spacing were not fully assessed. Comprehensive target sizing,
  scroll-versus-drag and mobile drawer gesture coverage remain NOT VERIFIED.
- Physical iOS/Android hardware is NOT VERIFIED.

## Semantics and keyboard

Observed named form fields, page headings, card drag handles, command combobox
and listbox, empty-result status, dialog labels and keyboard dismissal. Space /
arrow / Space moved a card and dnd-kit emitted a live status announcement.
The reviewer retracted its unsupported “no announcements” claim after this
runtime evidence. Actual spoken output is **NOT VERIFIED**: no NVDA,
VoiceOver or TalkBack session occurred. Axe cannot establish AT compatibility.

The reproduced drawer close defect was stacking, not a focus-hook rewrite:
navbar z-40 covered notification/profile z-30 close buttons. Raising drawer
roots to z-50 restored pointer hit testing; command palette remains z-70.
`useDialogFocus` is unchanged. See fix ledger for before/after evidence.

## Automated scan

Final production-fixture axe-core 4.10.2 scan: **42 route/theme combinations,
no violations** (WCAG 2/2.1/2.2 A/AA plus best-practice rules). Evidence:
`kanvora-v3-tools/axe-v3-final.json`, `v3-axe-final.log`. These are fixture-backed
route scans, not live end-to-end workflows or complete all-state conformance.
The 486-case geometry matrix is reported separately with its actual completion
status; small viewports are not substitutes for native zoom.
