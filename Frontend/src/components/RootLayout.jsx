// RootLayout component: renders a focused piece of the Kanvora UI.
import { useEffect, useMemo, useState } from 'react'
import Header from './Header'
import useDialogFocus from '../hooks/useDialogFocus'
import Navbar from './Navbar'
import Footer from './Footer'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import {
  BsBell,
  BsGrid3X3Gap,
  BsMoonStars,
  BsSearch,
  BsSun,
  BsX
} from 'react-icons/bs'
import {
  commandPaletteBackdrop,
  commandPalettePanel,
  dashboardMutedColor,
  fieldBase,
  iconButton
} from '../Styles/common'

//routes where only the dark dashboard Navbar is shown (not the public Header)
const navbarOnlyRoutes = []

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
  const { checkAuth, authChecked, loading } = useAuth()
  const [commandOpen, setCommandOpen] = useState(false)
  const commandRef = useDialogFocus(commandOpen, () => setCommandOpen(false))
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    return window.localStorage.getItem('kanvora-theme') || 'system'
  })

  useEffect(() => {
    if (!authChecked && !loading) {
      checkAuth()
    }
  }, [checkAuth, authChecked, loading])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches
    const resolved =
      theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
    root.dataset.theme = resolved
    window.localStorage.setItem('kanvora-theme', theme)
  }, [theme])

  useEffect(() => {
    const handler = (event) => {
      if (!event.key) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const showNavbar = navbarOnlyRoutes.some((r) => path.startsWith(r))
  const hideHeader = noHeaderRoutes.some((r) => path.startsWith(r))
  const hideFooter = noFooterRoutes.some((r) => path.startsWith(r))
  const commandItems = useMemo(
    () => [
      { label: 'Open dashboard', path: '/main-page', icon: <BsGrid3X3Gap /> },
      { label: 'Projects', path: '/workspaces/projects', icon: <BsGrid3X3Gap /> },
      {
        label: 'Templates marketplace',
        path: '/templates',
        icon: <BsSearch />
      },
      {
        label: 'Notifications',
        path: '/main-page/notifications',
        icon: <BsBell />
      },
      { label: 'Settings', path: '/workspaces/settings', icon: <BsMoonStars /> }
    ],
    []
  )
  const filteredCommands = commandItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  )

  const runCommand = (item) => {
    navigate(item.path)
    setCommandOpen(false)
    setQuery('')
  }

  return (
    <div>
      {/* dashboard Navbar for workspace pages only */}
      {showNavbar && <Navbar />}

      {/* marketing Header for public pages */}
      {!hideHeader && !showNavbar && <Header />}

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
            <div className="flex items-center gap-3 border-b border-[#2c333a] px-4 py-3">
              <BsSearch className={dashboardMutedColor} />
              <input
                aria-label="Search commands"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                placeholder="Search actions, pages, and settings..."
                className={`${fieldBase} border-0 bg-transparent px-0 focus:ring-0`}
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

            <div className="max-h-80 overflow-y-auto p-2 app-scrollbar">
              {filteredCommands.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => runCommand(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-[#d7dde4] hover:bg-[#22272b] hover:text-white"
                >
                  <span className="text-[#ff8aa0]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-[#2c333a] px-4 py-3">
              <span className={`text-xs ${dashboardMutedColor}`}>
                Ctrl+K opens this menu
              </span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RootLayout
