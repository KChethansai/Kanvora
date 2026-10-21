// Planner component: pre-login overview page for planning on boards.
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
    <div className="min-h-screen bg-[#f0fdfa]">
      <div className="bg-gradient-to-br from-teal-50 via-white to-cyan-50/50 px-6 py-20 border-b border-teal-100">
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-teal-900">
              Kanvora Planner
            </h1>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-teal-800">
              A planning overview, not a calendar integration
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-teal-700">
              Planner is a lightweight Kanvora overview. It does not connect to
              Google Calendar, Outlook, or any external calendar, and it does not
              import events.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/main-page')}
                className="rounded-lg bg-teal-700 px-6 py-3 font-semibold on-scrim transition-colors hover:bg-teal-800"
              >
                Open dashboard
              </button>
              <button
                onClick={() => navigate('/help')}
                className="rounded-lg border border-teal-200 bg-white px-6 py-3 font-semibold text-teal-700 transition-colors hover:border-teal-400"
              >
                Read the help center
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
              Connection status
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-800">
              <li>Google Calendar: not connected</li>
              <li>Outlook: not connected</li>
              <li>Event import: not available</li>
              <li>Card due dates: available on boards</li>
            </ul>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight text-teal-900">
          Plan work on the board
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center leading-relaxed text-teal-700">
          Kanvora keeps planning on boards. Use lists, due dates, labels, and
          comments instead of a separate calendar.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {planningPoints.map((point) => (
            <article
              key={point.title}
              className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-teal-800">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-teal-700">{point.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-teal-100 bg-teal-50 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-teal-900">
            Keep planning where the work lives
          </h2>
          <p className="mt-3 leading-relaxed text-teal-700">
            Open a board to add cards, set due dates, and move work between
            lists. Notifications stay in their own list.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate('/main-page')}
              className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold on-scrim transition-colors hover:bg-teal-800"
            >
              Open dashboard
            </button>
            <button
              onClick={() => navigate('/main-page/notifications')}
              className="rounded-lg border border-teal-200 bg-white px-5 py-2.5 font-semibold text-teal-700 transition-colors hover:border-teal-400"
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
