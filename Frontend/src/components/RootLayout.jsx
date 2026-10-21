// RootLayout component: renders a focused piece of the Kanvora UI.
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import Header from './Header'
import useDialogFocus from '../hooks/useDialogFocus'
import Footer from './Footer'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { isPublicShellPath } from '../config/themeScope'
import {
  BsBell,
  BsGrid3X3Gap,
  BsMoonStars,
  BsSearch,
  BsSun,
  BsX
} from 'react-icons/bs'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import {
  commandPaletteBackdrop,
  commandPalettePanel,
  dashboardMutedColor,
  iconButton
} from '../Styles/common'

//routes where NO header and NO footer are shown (full-screen app pages)
const noHeaderRoutes = ['/main-page', '/templates', '/workspaces', '/projects','/login','/register']

//routes where the Footer should be hidden
const noFooterRoutes = [
  '/login',
  '/register',
  '/main-page',
  '/templates',
  '/workspaces',
  '/projects'
]

function RootLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const path = pathname.toLowerCase()
  const { checkAuth, authChecked, loading, isAuthenticated, currentUser } = useAuth()
  const { workspaces, activeWorkspace } = useWorkspaceStore()
  const [commandOpen, setCommandOpen] = useState(false)
  const commandRef = useDialogFocus(commandOpen, () => setCommandOpen(false))
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = window.localStorage.getItem('kanvora-theme')
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
  })
  // The public marketing shell always presents the light palette; the
  // authenticated application follows the stored preference.
  const publicShell = isPublicShellPath(pathname)

  useEffect(() => {
    if (!authChecked && !loading) {
      checkAuth()
    }
  }, [checkAuth, authChecked, loading])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // The scope attribute is applied before the browser paints, so a route
  // change never shows one frame of the wrong palette. The document keeps
  // the user's preference in `data-theme`; the scope only re-binds the
  // tokens for the public shell.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (publicShell) root.dataset.themeScope = 'light'
    else delete root.dataset.themeScope
  }, [publicShell])

  useLayoutEffect(() => {
    const root = document.documentElement
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : { matches: false, addEventListener() {}, removeEventListener() {} }
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      root.dataset.theme = resolved
      // The effective palette decides the native widget rendering, so the
      // browser draws date pickers and scrollbars in the visible theme.
      const scoped = root.dataset.themeScope === 'light'
      root.style.colorScheme = scoped ? 'light' : resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        meta.setAttribute('content', scoped || resolved === 'light' ? '#f3faf8' : '#0f172a')
      }
    }
    apply()
    window.localStorage.setItem('kanvora-theme', theme)
    if (theme !== 'system') return
    // System is a live preference, not a one-time snapshot.
    media.addEventListener?.('change', apply)
    return () => media.removeEventListener?.('change', apply)
  }, [theme, publicShell])

  useEffect(() => {
    const handler = (event) => {
      if (!event.key) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      // Escape is owned by useDialogFocus for the palette overlay. A second
      // window-level Escape listener would give one key two owners.
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const hideHeader = noHeaderRoutes.some((r) => path.startsWith(r))
  const hideFooter = noFooterRoutes.some((r) => path.startsWith(r))

  // The palette must never offer a destination the viewer cannot reach. The
  // session state decides what is public and what is protected: while the
  // session is still being checked, only the public destinations are offered,
  // so a protected command can never flash before the answer is known.
  const sessionKnown = authChecked && !loading
  const isMemberOfActiveWorkspace = useMemo(() => {
    const userId = currentUser?._id?.toString()
    if (!userId || !activeWorkspace) return false
    return (activeWorkspace.members || []).some((member) => {
      const memberId = member.user?._id || member.user
      return memberId?.toString() === userId
    })
  }, [activeWorkspace, currentUser?._id])

  const commandItems = useMemo(() => {
    const publicItems = [
      { label: 'Features', path: '/features', icon: <BsGrid3X3Gap />, group: 'Pages' },
      { label: 'Solutions', path: '/solutions', icon: <BsGrid3X3Gap />, group: 'Pages' },
      { label: 'Resources', path: '/resources', icon: <BsSearch />, group: 'Pages' },
      { label: 'Help center', path: '/help', icon: <BsSearch />, group: 'Pages' }
    ]
    if (!sessionKnown || !isAuthenticated) return publicItems

    const appItems = [
      { label: 'Open dashboard', path: '/main-page', icon: <BsGrid3X3Gap />, group: 'Go to' },
      {
        label: 'Templates marketplace',
        path: '/templates',
        icon: <BsSearch />,
        group: 'Go to'
      },
      {
        label: 'Notifications',
        path: '/main-page/notifications',
        icon: <BsBell />,
        group: 'Go to'
      }
    ]
    // The workspace panels only exist for a member of a workspace.
    if (workspaces.length > 0 || isMemberOfActiveWorkspace) {
      appItems.push({
        label: 'Projects',
        path: '/workspaces/projects',
        icon: <BsGrid3X3Gap />,
        group: 'Go to'
      })
      appItems.push({
        label: 'Settings',
        path: '/workspaces/settings',
        icon: <BsMoonStars />,
        group: 'Go to'
      })
    }
    return [...publicItems, ...appItems]
  }, [sessionKnown, isAuthenticated, workspaces.length, isMemberOfActiveWorkspace])

  const runCommand = (item) => {
    navigate(item.path)
    setCommandOpen(false)
    setQuery('')
  }

  // The matching is done here rather than by cmdk so the announced result
  // count is exactly what is on screen, and the matching rule stays the one
  // the palette has always used (a case-insensitive substring of the label).
  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commandItems
    return commandItems.filter((item) => item.label.toLowerCase().includes(needle))
  }, [commandItems, query])

  const groupedCommands = useMemo(() => {
    const groups = new Map()
    for (const item of filteredCommands) {
      const group = item.group || 'Go to'
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(item)
    }
    return [...groups.entries()]
  }, [filteredCommands])

  return (
    <div>
      {/* marketing Header for public pages */}
      {!hideHeader && <Header />}

      <div className={hideHeader && !['/login', '/register'].some((route) => path.startsWith(route)) ? 'h-screen overflow-hidden' : 'min-h-screen'}>
        <Outlet />
      </div>

      {!hideFooter && <Footer />}

      {commandOpen && (
        <div
          className={commandPaletteBackdrop}
          onClick={() => setCommandOpen(false)}
        >
          <div
            ref={commandRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            tabIndex={-1}
            className={`${commandPalettePanel} animate-enter`}
            onClick={(event) => event.stopPropagation()}
          >
            <Command shouldFilter={false}>
              <div className="flex items-center gap-3 border-b border-[var(--kt-border)] px-3">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  aria-label="Search commands"
                  placeholder="Search actions, pages, and settings..."
                />
                <button
                  type="button"
                  aria-label="Close command palette"
                  onClick={() => setCommandOpen(false)}
                  className={iconButton}
                >
                  <BsX aria-hidden="true" />
                </button>
              </div>

              <CommandList>
                <CommandEmpty>No matching command.</CommandEmpty>
                {groupedCommands.map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.path}
                        value={`${item.label} ${item.path}`}
                        onSelect={() => runCommand(item)}
                      >
                        <span className="text-[var(--kt-accent-text)]" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>

              {/* A live region so the result count is announced, not only
                  painted. The empty state below is the same information. */}
              <p className="sr-only" role="status" aria-live="polite">
                {filteredCommands.length === 0
                  ? 'No commands match the search.'
                  : `${filteredCommands.length} command${
                      filteredCommands.length === 1 ? '' : 's'
                    } available.`}
              </p>
            </Command>

            <div className="flex items-center justify-between border-t border-[#2c333a] px-4 py-3">
              <span className={`text-xs ${dashboardMutedColor}`}>
                Ctrl+K opens this menu
              </span>
              {/* The theme preference belongs to the application. On the public
                  shell the palette is fixed to light, so a switcher there would
                  be a control that changes nothing. */}
              {!publicShell && (
                <div className="flex items-center gap-2">
                  {[
                    { id: 'light', label: 'Light', icon: <BsSun /> },
                    { id: 'dark', label: 'Dark', icon: <BsMoonStars /> },
                    { id: 'system', label: 'System', icon: <BsGrid3X3Gap /> }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      aria-pressed={theme === option.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                        theme === option.id
                          ? 'premium-button-glow bg-[#ff4d67] text-white'
                          : 'bg-white/[0.06] text-[#a1a1aa] hover:text-white'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RootLayout
