// Design component: pre-login marketing page for design teams.
import { useNavigate } from 'react-router-dom'
import { pubBtnPrimary } from '../Styles/common'

const workflowCards = [
  {
    title: 'Design Request Intake',
    desc: 'Collect creative requests as cards, prioritize them with labels, and keep stakeholder decisions in comments.',
    color: 'from-[var(--kt-pub-fill-400)] to-[var(--kt-pub-cyan-500)]'
  },
  {
    title: 'Reference Attachments',
    desc: 'Attach JPEG or PNG reference images to a card so the brief and the visual stay together.',
    color: 'from-[var(--kt-pub-cyan-400)] to-[var(--kt-pub-fill-600)]'
  },
  {
    title: 'Launch Checklist',
    desc: 'Track each deliverable with checklists, due dates, and an assignee on the card.',
    color: 'from-[var(--kt-pub-wash-strong)] to-[var(--kt-pub-emerald-500)]'
  }
]

function Design() {
  const navigate = useNavigate()

  return (
    <main className="bg-[var(--kt-pub-bg)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[var(--kt-pub-wash)] via-[var(--kt-pub-surface)] to-[var(--kt-pub-cyan-50)]/50 py-20 px-6 border-b border-[var(--kt-pub-line)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <button type="button"
              onClick={() => navigate('/solutions')}
              className="text-[var(--kt-pub-ink-muted)] hover:underline text-sm mb-6 flex items-center gap-1 font-semibold"
            >
              ← Back to Solutions
            </button>
            <h1 className="text-5xl font-bold text-[var(--kt-pub-ink)] mb-5 leading-tight tracking-tight">
              Kanvora for Design Teams
            </h1>
            <p className="text-lg text-[var(--kt-pub-ink-muted)] mb-8 leading-relaxed">
              Keep design requests, review notes, and delivery checklists on one
              board. Cards hold descriptions, comments, checklists, due dates,
              and image attachments.
            </p>
            <button type="button"
              onClick={() => navigate('/register')}
              className={`${pubBtnPrimary} px-8 py-3.5 text-base rounded-xl`}
            >
              Start with a board
            </button>
          </div>
          <div className="flex-1 rounded-2xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kt-pub-ink-muted)]">
              Example design board
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['Requests', 'In Design', 'Review', 'Approved'].map((list) => (
                <div
                  key={list}
                  className="rounded-xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-wash)]/60 p-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--kt-pub-ink-muted)]">
                    {list}
                  </p>
                  <div className="mt-2 h-10 rounded-lg border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)]" />
                  <div className="mt-2 h-10 rounded-lg border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow cards */}
      <div className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-[var(--kt-pub-ink)] text-center mb-4 tracking-tight">
            Built for every stage of the creative process
          </h2>
          <p className="text-center text-[var(--kt-pub-ink-muted)] mb-12 max-w-2xl mx-auto leading-relaxed">
            Shape the lists around your own review process and keep the details
            on each card.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workflowCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl overflow-hidden border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] shadow-sm"
              >
                <div className={`h-32 bg-gradient-to-br ${card.color} opacity-90`} />
                <div className="p-6">
                  <h3 className="font-bold text-[var(--kt-pub-ink-strong)] text-lg mb-2">
                    {card.title}
                  </h3>
                  <p className="text-[var(--kt-pub-ink-muted)] text-sm leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature: review context */}
      <div className="bg-[var(--kt-pub-wash)] py-20 px-6 border-y border-[var(--kt-pub-line)]">
        <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-2 md:items-center">
          <div className="rounded-2xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--kt-pub-ink-muted)]">
              On every card
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kt-pub-ink-strong)]">
              <li>Description and due date</li>
              <li>Comments with @mentions</li>
              <li>Checklists for review steps</li>
              <li>JPEG and PNG reference attachments</li>
            </ul>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-[var(--kt-pub-ink)] mb-4 tracking-tight">
              Keep review context on the card
            </h2>
            <p className="text-[var(--kt-pub-ink-muted)] text-lg mb-6 leading-relaxed">
              Comments and checklists keep feedback next to the work instead of
              spread across separate threads. There is no separate timeline or
              calendar view in Kanvora.
            </p>
            <button type="button"
              onClick={() => navigate('/help')}
              className="text-[var(--kt-pub-ink-muted)] font-semibold hover:underline flex items-center gap-1"
            >
              Read the help center
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-[var(--kt-pub-accent)] to-[var(--kt-pub-accent-deep)] py-16 px-6 text-center">
        <h2 className="text-4xl font-bold on-scrim mb-4 tracking-tight">
          Great design starts with great organization.
        </h2>
        <p className="on-scrim text-lg mb-8 max-w-xl mx-auto leading-relaxed">
          Start from a published template or shape a board around your own
          design process.
        </p>
        <button type="button"
          onClick={() => navigate('/templates')}
          className="bg-[var(--kt-pub-surface)] text-[var(--kt-pub-ink-muted)] hover:bg-[var(--kt-pub-wash)] font-bold px-8 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
        >
          Browse templates
        </button>
      </div>
    
    </main>
  )
}

export default Design
