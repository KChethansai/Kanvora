// Frontend/src/tests/setup.js
//
// Test environment shims.
//
// The command palette (cmdk) uses two browser APIs that jsdom does not
// implement: a ResizeObserver to measure its list, and scrollIntoView to keep
// the selected item visible. Real browsers have both. The shims below are
// no-ops that exist only so the suite can exercise the component in jsdom.
//
// Nothing here changes application behaviour.

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
