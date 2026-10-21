// Engineering component: pre-login marketing page for engineering teams.
import { useNavigate } from 'react-router-dom'
import { BsCheck2Circle } from 'react-icons/bs'

const practices = [
  {
    title: 'Plan sprints on a board',
    desc: 'Use lists for the stages your team actually uses, then drag cards between them as work moves.'
  },
  {
    title: 'Keep details on the card',
    desc: 'Add a description, due date, labels, checklist, assignee, comments, and image attachments.'
  },
  {
    title: 'Review work in one place',
    desc: 'Comments and mentions keep decisions next to the card instead of in a separate thread.'
  },
  {
    title: 'Start from structure',
    desc: 'Use a published template or create a board and shape its three starting lists.'
  }
]

const templates = [
  {
    title: 'Sprint board',
    desc: 'Lists for the backlog, active work, review, and done. Cards hold owners, due dates, and checklists.'
  },
  {
    title: 'Release checklist',
    desc: 'A board for the checks that must pass before shipping, with labels for risk areas.'
  },
  {
    title: 'Bug triage',
    desc: 'Lists for new, investigating, fixed, and verified reports, with comments for reproduction notes.'
  }
]

function Engineering() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f0fdfa]">
      <div className="bg-gradient-to-br from-teal-50 via-white to-cyan-50/50 px-6 py-16 border-b border-teal-100">
        <div className="mx-auto max-w-6xl">
          <button
            className="text-sm font-semibold text-teal-700 underline underline-offset-4 hover:text-teal-800"
            onClick={() => navigate('/solutions')}
          >
            Back to solutions
          </button>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-teal-900">
            Kanvora for Engineering Teams
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-teal-700">
            Keep sprint work, bug fixes, and release checks on boards your team
            can read at a glance. Kanvora provides lists, cards, labels,
            comments, checklists, due dates, and image attachments.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="mt-8 rounded-xl bg-teal-700 px-6 py-3 font-semibold on-scrim transition-colors hover:bg-teal-800"
          >
            Start with a board
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold tracking-tight text-teal-900">
          A board for the way engineering work moves
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {practices.map((practice) => (
            <article
              key={practice.title}
              className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm"
            >
              <BsCheck2Circle className="text-xl text-teal-600" />
              <h3 className="mt-3 text-lg font-bold text-teal-800">
                {practice.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-teal-700">
                {practice.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-teal-100 bg-teal-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold tracking-tight text-teal-900">
            Example engineering workflows
          </h2>
          <p className="mt-3 max-w-2xl text-teal-700">
            These are example board structures you can build yourself or start
            from a published template.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {templates.map((template) => (
              <article
                key={template.title}
                className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-teal-800">
                  {template.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-teal-700">
                  {template.desc}
                </p>
              </article>
            ))}
          </div>
          <button
            onClick={() => navigate('/templates')}
            className="mt-8 rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:border-teal-400"
          >
            Browse templates
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-teal-900">
              What Kanvora does not include
            </h2>
            <p className="mt-4 text-teal-700 leading-relaxed">
              Kanvora does not currently offer Timeline View, GitHub, Jira,
              GitLab, or custom-field integrations, an automation engine, or AI
              features. Engineering work stays on boards, cards, and comments.
            </p>
            <button
              onClick={() => navigate('/help')}
              className="mt-6 text-sm font-semibold text-teal-700 underline underline-offset-4 hover:text-teal-800"
            >
              Read the help center
            </button>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">
              Available today
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-800">
              <li>Boards, lists, cards, labels, and drag-and-drop ordering</li>
              <li>Comments, mentions, checklists, due dates, and assignees</li>
              <li>JPEG and PNG image attachments with access checks</li>
              <li>Workspaces, roles, invitations, and notifications</li>
              <li>Published templates and a searchable help center</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Engineering
