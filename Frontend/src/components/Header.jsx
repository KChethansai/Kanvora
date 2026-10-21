import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import kanvoraLogo from '../assets/kanvora-logo.png'
import { BsArrowRight, BsBell, BsGrid3X3Gap, BsList, BsX } from 'react-icons/bs'
import { useAuth } from '../store/authStore'
import { pubBtnPrimary, pubBtnSecondary, pubIconBtn } from '../Styles/common'

const navItems = [
  { label: 'Features', path: '/features' },
  { label: 'Solutions', path: '/solutions' },
  { label: 'Resources', path: '/resources' },
  { label: 'Help', path: '/help' }
]

function Header() {
  const navigate = useNavigate()
  const { isAuthenticated, currentUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)

  const getInitials = (name) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const go = (path) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--kt-border)] bg-[var(--kt-surface)] backdrop-blur-xl">
      <div className="w-full flex h-16 items-center justify-between px-[25px]">

        {/* Left: Logo + nav */}
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => go('/')}
            className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
          >
            <img
              className="h-10 w-10 rounded-xl shadow-sm"
              src={kanvoraLogo}
              alt="Kanvora"
            />
            <span className="block text-lg font-bold text-[var(--kt-text)] leading-tight">
              Kanvora
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--kt-muted)] transition-colors hover:bg-[var(--kt-surface-soft)] hover:text-[var(--kt-text)]"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Auth buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => go('/main-page/notifications')}
                className={pubIconBtn}
                aria-label="Open notifications"
              >
                <BsBell />
              </button>
              <button
                type="button"
                onClick={() => go('/main-page')}
                className={pubBtnPrimary}
              >
                <BsGrid3X3Gap /> Workspace
              </button>
              <button
                type="button"
                onClick={() => go('/main-page/profile')}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--kt-accent)] text-sm font-bold text-[var(--kt-on-accent)] ring-2 ring-[var(--kt-border-strong)]"
                aria-label="Open profile"
              >
                {currentUser?.profilePic ? (
                  <img
                    src={currentUser.profilePic}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(currentUser?.name)
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => go('/login')}
                className={pubBtnSecondary}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => go('/register')}
                className={pubBtnPrimary}
              >
                Sign up <BsArrowRight />
              </button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          ref={menuButtonRef}
          className={`${pubIconBtn} md:hidden`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-menu"
        >
          {menuOpen ? <BsX /> : <BsList />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="public-mobile-menu"
          className="border-t border-[var(--kt-border)] bg-[var(--kt-surface)] px-4 py-4 md:hidden"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setMenuOpen(false)
            menuButtonRef.current?.focus()
          }}
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--kt-muted)] hover:bg-[var(--kt-surface-soft)]"
              >
                {item.label}
              </button>
            ))}
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => go('/main-page/notifications')}
                  className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--kt-muted)] hover:bg-[var(--kt-surface-soft)]"
                >
                  Notifications
                </button>
                <button
                  type="button"
                  onClick={() => go('/main-page/profile')}
                  className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--kt-muted)] hover:bg-[var(--kt-surface-soft)]"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => go('/main-page')}
                  className={`${pubBtnPrimary} mt-2 w-full`}
                >
                  Open workspace
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => go('/login')}
                  className={`${pubBtnSecondary} mt-2 w-full`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => go('/register')}
                  className={`${pubBtnPrimary} w-full`}
                >
                  Start for free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
