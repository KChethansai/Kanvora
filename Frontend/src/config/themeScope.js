// Route-aware theme scope.
//
// The public marketing shell always presents the light palette, whatever the
// application preference is. The authenticated application follows the stored
// Light / Dark / System setting. The document keeps the user's preference in
// `data-theme`; the public shell additionally sets `data-theme-scope="light"`
// on the document element, which re-binds the semantic tokens inside that
// scope without touching the stored preference.
//
// The prefix list below is the single source of truth for the application
// routes. The boot script in `index.html` repeats it so the first paint is
// already correct; `theme-scope-consistency.test.js` asserts that the two
// lists never drift apart.

export const APP_ROUTE_PREFIXES = [
  '/main-page',
  '/workspaces',
  '/templates',
  '/projects',
  '/inbox',
  '/planner'
]

const matchesPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

// Public shell: everything that is not an authenticated application route.
export const isPublicShellPath = (pathname) => {
  const path = String(pathname || '/').toLowerCase()
  return !APP_ROUTE_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
}
