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
    <main className="min-h-screen bg-[var(--kt-pub-bg)]">
      <div className="bg-gradient-to-br from-[var(--kt-pub-wash)] via-[var(--kt-pub-surface)] to-[var(--kt-pub-cyan-50)]/50 px-6 py-16 border-b border-[var(--kt-pub-line)]">
        <div className="mx-auto max-w-6xl">
          <button type="button"
            className="text-sm font-semibold text-[var(--kt-pub-ink-muted)] underline underline-offset-4 hover:text-[var(--kt-pub-ink-strong)]"
            onClick={() => navigate('/solutions')}
          >
            Back to solutions
          </button>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-[var(--kt-pub-ink)]">
            Kanvora for Engineering Teams
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--kt-pub-ink-muted)]">
            Keep sprint work, bug fixes, and release checks on boards your team
            can read at a glance. Kanvora provides lists, cards, labels,
            comments, checklists, due dates, and image attachments.
          </p>
          <button type="button"
            onClick={() => navigate('/register')}
            className="mt-8 rounded-xl bg-[var(--kt-pub-accent)] px-6 py-3 font-semibold on-scrim transition-colors hover:bg-[var(--kt-pub-accent-strong)]"
          >
            Start with a board
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--kt-pub-ink)]">
          A board for the way engineering work moves
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {practices.map((practice) => (
            <article
              key={practice.title}
              className="rounded-2xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-6 shadow-sm"
            >
              <BsCheck2Circle className="text-xl text-[var(--kt-pub-ink-accent)]" />
              <h3 className="mt-3 text-lg font-bold text-[var(--kt-pub-ink-strong)]">
                {practice.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kt-pub-ink-muted)]">
                {practice.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--kt-pub-line)] bg-[var(--kt-pub-wash)] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--kt-pub-ink)]">
            Example engineering workflows
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--kt-pub-ink-muted)]">
            These are example board structures you can build yourself or start
            from a published template.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {templates.map((template) => (
              <article
                key={template.title}
                className="rounded-2xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-[var(--kt-pub-ink-strong)]">
                  {template.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kt-pub-ink-muted)]">
                  {template.desc}
                </p>
              </article>
            ))}
          </div>
          <button type="button"
            onClick={() => navigate('/templates')}
            className="mt-8 rounded-lg border border-[var(--kt-pub-line-strong)] bg-[var(--kt-pub-surface)] px-4 py-2 text-sm font-semibold text-[var(--kt-pub-ink-muted)] transition-colors hover:border-[var(--kt-pub-line-accent)]"
          >
            Browse templates
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--kt-pub-ink)]">
              What Kanvora does not include
            </h2>
            <p className="mt-4 text-[var(--kt-pub-ink-muted)] leading-relaxed">
              Kanvora does not currently offer Timeline View, GitHub, Jira,
              GitLab, or custom-field integrations, an automation engine, or AI
              features. Engineering work stays on boards, cards, and comments.
            </p>
            <button type="button"
              onClick={() => navigate('/help')}
              className="mt-6 text-sm font-semibold text-[var(--kt-pub-ink-muted)] underline underline-offset-4 hover:text-[var(--kt-pub-ink-strong)]"
            >
              Read the help center
            </button>
          </div>
          <div className="rounded-2xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--kt-pub-ink-muted)]">
              Available today
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kt-pub-ink-strong)]">
              <li>Boards, lists, cards, labels, and drag-and-drop ordering</li>
              <li>Comments, mentions, checklists, due dates, and assignees</li>
              <li>JPEG and PNG image attachments with access checks</li>
              <li>Workspaces, roles, invitations, and notifications</li>
              <li>Published templates and a searchable help center</li>
            </ul>
          </div>
        </div>
      </section>
    
    </main>
  )
}

export default Engineering
