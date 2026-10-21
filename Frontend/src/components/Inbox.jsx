import { useNavigate } from 'react-router-dom'
import {
  BsArrowRight,
  BsBell,
  BsCheck2Circle,
  BsKanban,
  BsPencilSquare
} from 'react-icons/bs'

// `/inbox` is an authenticated route (App.jsx puts it behind ProtectedRoute)
// and `themeScope.js` classifies it as an APP route, so it has to read from
// the application tokens. It used to paint a fixed near-black panel and band,
// which meant the page ignored the stored theme: the shell was themed, the
// surfaces under it were not.
const features = [
  {
    title: 'Manual entry only',
    text: 'Work enters Kanvora when you add a card on a board. Inbox does not read email, Slack, or any external tool.',
    icon: <BsPencilSquare />
  },
  {
    title: 'Open the real notification list',
    text: 'Use Notifications to review board updates, mentions, and invitations in one place.',
    icon: <BsBell />
  },
  {
    title: 'Boards stay the source of truth',
    text: 'Open the dashboard to work with the lists and cards that hold the actual work.',
    icon: <BsKanban />
  }
]

function Inbox() {
  const navigate = useNavigate()

  return (
    <main className="premium-app-bg min-h-screen">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--kt-accent-text)]">
            Inbox overview
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--kt-text)] sm:text-5xl">
            A lightweight overview, not an external inbox.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--kt-muted)]">
            Inbox is a local Kanvora overview surface. It is not connected to
            external email, Slack, or another capture service. To add work, open
            a board and create a card.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kt-accent)] px-4 py-2 text-sm font-semibold text-[var(--kt-on-accent)] transition-colors hover:bg-[var(--kt-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
              onClick={() => navigate('/main-page')}
            >
              Open dashboard <BsArrowRight />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface)] px-4 py-2 text-sm font-semibold text-[var(--kt-text)] transition-colors hover:bg-[var(--kt-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
              onClick={() => navigate('/main-page/notifications')}
            >
              Open notifications
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface-raised)] p-6 shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--kt-accent-text)]">
            Connection status
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kt-muted)]">
            <li>External email: not connected</li>
            <li>Slack or chat capture: not connected</li>
            <li>Calendar sync: not connected</li>
            <li>Notifications: available at /main-page/notifications</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-6 transition-colors hover:bg-[var(--kt-surface-soft)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--kt-accent-soft)] text-xl text-[var(--kt-accent-text)]">
                {feature.icon}
              </span>
              <h2 className="mt-5 text-lg font-bold text-[var(--kt-text)]">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--kt-muted)]">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--kt-border)] bg-[var(--kt-surface-soft)] px-4 py-14 text-center text-[var(--kt-text)]">
        <BsCheck2Circle className="mx-auto mb-4 text-3xl text-[var(--kt-accent-text)]" />
        <h2 className="text-3xl font-bold">Where the work actually lives</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--kt-muted)]">
          Kanvora keeps work on boards, lists, and cards. Use the dashboard for
          the active workspace and Notifications for updates.
        </p>
        <button
          type="button"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kt-accent)] px-5 py-2.5 text-sm font-bold text-[var(--kt-on-accent)] transition-colors hover:bg-[var(--kt-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
          onClick={() => navigate('/main-page')}
        >
          Open dashboard
        </button>
      </section>
    </main>
  )
}

export default Inbox
