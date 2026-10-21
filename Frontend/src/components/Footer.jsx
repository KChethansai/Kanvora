import { Link } from 'react-router-dom'
import BrandMark from './BrandMark'

const footerLinks = [
  { title: 'About Kanvora', text: "What's behind the board", path: '/about' },
  { title: 'Templates', text: 'Start a board from a template', path: '/templates' },
  { title: 'Resources', text: 'Guides for better collaboration', path: '/resources' },
  { title: 'Help center', text: 'Answers for boards, accounts, and install', path: '/help' }
]

function Footer() {
  return (
    <footer className="border-t border-[var(--kt-border)] bg-[var(--kt-surface)] text-[var(--kt-text)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
        {/* Brand */}
        <div>
          <BrandMark size="lg" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--kt-muted)]">
            Modern boards, workspaces, templates, and collaboration flows for
            teams that need clarity without ceremony.
          </p>
        </div>

        {/* Links */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {footerLinks.map((link) => (
            <Link
              key={link.title}
              to={link.path}
              className="rounded-xl border border-transparent p-4 text-left transition-all hover:border-[var(--kt-border)] hover:bg-[var(--kt-surface-soft)] hover:shadow-sm"
            >
              <span className="block text-sm font-bold text-[var(--kt-text)]">{link.title}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--kt-muted)]">{link.text}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--kt-border)] px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-[var(--kt-muted)]">
          © {new Date().getFullYear()} Kanvora. Built for teams who value clarity.
        </p>
      </div>
    </footer>
  )
}

export default Footer
