// Planner component: overview of planning on boards.
// `/planner` is an authenticated route (App.jsx puts it behind ProtectedRoute)
// and `themeScope.js` classifies it as an APP route, so it has to read from
// the application tokens. It used to paint the fixed marketing teal palette
// (teal-50 page, teal-900 headings, white cards), which in the dark theme
// rendered a white card on a dark page. The copy is unchanged: it still says
// plainly that this is not a calendar integration.
import { useNavigate } from 'react-router-dom'

const planningPoints = [
  {
    title: 'Due dates on cards',
    desc: 'Set a due date on a card and review it from the board or the workspace Cards overview.'
  },
  {
    title: 'Drag work between lists',
    desc: 'Move a card to the list that matches its current stage, then refresh if a move fails.'
  },
  {
    title: 'Status lanes',
    desc: 'Cards carry To Do, In Progress, or Done status labels so the board shows where work stands.'
  }
]

function Planner() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[var(--kt-bg)]">
      <div className="border-b border-[var(--kt-border)] bg-linear-to-br from-[var(--kt-surface-soft)] via-[var(--kt-surface)] to-[var(--kt-bg)] px-6 py-20">
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-[var(--kt-text)]">
              Kanvora Planner
            </h1>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--kt-text)]">
              A planning overview, not a calendar integration
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--kt-muted)]">
              Planner is a lightweight Kanvora overview. It does not connect to
              Google Calendar, Outlook, or any external calendar, and it does not
              import events.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/main-page')}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--kt-accent)] px-6 py-3 font-semibold text-[var(--kt-on-accent)] transition-colors hover:bg-[var(--kt-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
              >
                Open dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/help')}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface)] px-6 py-3 font-semibold text-[var(--kt-text)] transition-colors hover:bg-[var(--kt-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
              >
                Read the help center
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kt-accent-text)]">
              Connection status
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kt-muted)]">
              <li>Google Calendar: not connected</li>
              <li>Outlook: not connected</li>
              <li>Event import: not available</li>
              <li>Card due dates: available on boards</li>
            </ul>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--kt-text)]">
          Plan work on the board
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center leading-relaxed text-[var(--kt-muted)]">
          Kanvora keeps planning on boards. Use lists, due dates, labels, and
          comments instead of a separate calendar.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {planningPoints.map((point) => (
            <article
              key={point.title}
              className="rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-6 shadow-sm transition-colors hover:bg-[var(--kt-surface-soft)]"
            >
              <h3 className="text-lg font-bold text-[var(--kt-text)]">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kt-muted)]">{point.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--kt-border)] bg-[var(--kt-surface-soft)] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--kt-text)]">
            Keep planning where the work lives
          </h2>
          <p className="mt-3 leading-relaxed text-[var(--kt-muted)]">
            Open a board to add cards, set due dates, and move work between
            lists. Notifications stay in their own list.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/main-page')}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--kt-accent)] px-5 py-2.5 font-semibold text-[var(--kt-on-accent)] transition-colors hover:bg-[var(--kt-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
            >
              Open dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/main-page/notifications')}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface)] px-5 py-2.5 font-semibold text-[var(--kt-text)] transition-colors hover:bg-[var(--kt-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]"
            >
              Open notifications
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Planner
