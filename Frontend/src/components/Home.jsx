import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BsArrowRight,
  BsBarChart,
  BsCheck2Circle,
  BsKanban,
  BsLightning,
  BsPeopleFill,
  BsStars
} from 'react-icons/bs'
import { useAuth } from '../store/authStore'
import { pubBtnPrimary, pubBtnSecondary } from '../Styles/common'

// Marketing pages sit on a FIXED light surface in both themes, so the shared
// `pubEyebrow` token (theme accent ink) would be near-invisible in the dark
// theme. This copy keeps the same typography with a light-surface-safe ink.
const lightSurfaceEyebrow =
  'text-xs font-bold uppercase tracking-[0.18em] text-[var(--kt-pub-ink-muted)]'

const highlights = [
  {
    icon: <BsKanban />,
    title: 'Visual workspaces',
    desc: 'Plan projects with boards, lists, cards, labels, and drag-and-drop workflows.'
  },
  {
    icon: <BsPeopleFill />,
    title: 'Collaboration built in',
    desc: 'Invite teams, manage workspace members, and keep every update visible.'
  },
  {
    icon: <BsLightning />,
    title: 'Fast execution',
    desc: 'Create work quickly with templates, the Ctrl/Cmd+K command menu, and focused board views.'
  },
  {
    icon: <BsBarChart />,
    title: 'Operational clarity',
    desc: 'Track progress with status lanes, recent projects, and lightweight activity cues.'
  }
]

const stats = [
  ['Boards', 'lists, cards, labels'],
  ['Live', 'socket board updates'],
  ['Templates', 'start a new board']
]

function Home() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/main-page', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/register', { state: { email } })
  }

  return (
    <main className="overflow-hidden bg-[var(--kt-pub-bg)]">
      {/* Hero section */}
      <section className="relative">
        <div className="absolute inset-0 -z-0 bg-gradient-to-br from-[var(--kt-pub-wash-soft)]/60 via-[var(--kt-pub-surface)] to-[var(--kt-pub-cyan-50)]/40" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <div className="animate-slide-up">
            <p className={lightSurfaceEyebrow}>Modern collaboration platform</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--kt-pub-ink)] sm:text-5xl lg:text-6xl leading-tight">
              Turn scattered tasks into calm, visible team momentum.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--kt-pub-ink-muted)]">
              Kanvora is a board-based workspace for planning, assigning,
              discussing, and shipping work without losing context between
              boards, teams, and updates.
            </p>

            {isAuthenticated ? (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate('/main-page')}
                  className={pubBtnPrimary}
                >
                  Go to your workspace <BsArrowRight />
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 flex-1 rounded-lg border border-[var(--kt-pub-line-strong)] bg-[var(--kt-pub-surface)] px-4 text-sm text-[var(--kt-pub-ink)] shadow-sm outline-none transition focus:border-[var(--kt-pub-chip)] focus:ring-2 focus:ring-[var(--kt-pub-chip)]/20 placeholder:text-[var(--kt-pub-ink-muted)]"
                />
                <button type="submit" className={pubBtnPrimary}>
                  Start free <BsArrowRight />
                </button>
              </form>
            )}

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {stats.map(([value, label]) => (
                <div key={label} className="bg-[var(--kt-pub-surface)] border border-[var(--kt-pub-line)] rounded-xl px-4 py-3 shadow-sm">
                  <p className="text-lg font-bold text-[var(--kt-pub-ink-strong)]">{value}</p>
                  <p className="text-xs text-[var(--kt-pub-ink-muted)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-enter">
            <div className="absolute -inset-4 rounded-[2rem] bg-[var(--kt-pub-wash-mid)]/40 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl bg-[var(--kt-pub-surface)] border border-[var(--kt-pub-line)] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--kt-pub-line)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--kt-pub-ink-strong)]">
                  Illustrative board preview
                </p>
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--kt-pub-wash-mid)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--kt-pub-wash-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--kt-pub-fill-400)]" />
                </div>
              </div>
              <div className="grid gap-3 bg-[var(--kt-pub-wash)]/60 p-4 sm:grid-cols-3">
                {[
                  ['To Do', ['Outline release notes', 'Review onboarding copy']],
                  ['In Progress', ['Polish board labels', 'Check card attachments']],
                  ['Done', ['Invite the team', 'Create first workspace']]
                ].map(([list, cards]) => (
                  <div
                    key={list}
                    className="rounded-xl border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] p-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--kt-pub-ink-muted)]">
                      {list}
                    </p>
                    <div className="mt-2 space-y-2">
                      {cards.map((card) => (
                        <div
                          key={card}
                          className="rounded-lg border border-[var(--kt-pub-line)] bg-[var(--kt-pub-wash)]/50 px-2.5 py-2 text-xs font-medium text-[var(--kt-pub-ink-strong)]"
                        >
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-t border-[var(--kt-pub-line)] bg-[var(--kt-pub-wash)] p-4 sm:grid-cols-3">
                {['Plan', 'Collaborate', 'Ship'].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg bg-[var(--kt-pub-surface)] border border-[var(--kt-pub-line)] px-3 py-2 text-sm font-semibold text-[var(--kt-pub-ink-muted)]"
                  >
                    <BsCheck2Circle className="text-[var(--kt-pub-ink-accent)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className={lightSurfaceEyebrow}>Designed for daily work</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--kt-pub-ink)]">
              Everything your team expects, nothing in the way.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className={`${pubBtnSecondary} hidden sm:inline-flex`}
          >
            <BsStars /> Browse templates
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <article
              key={item.title}
              className="bg-[var(--kt-pub-surface)] border border-[var(--kt-pub-line)] rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--kt-pub-wash-soft)] text-xl text-[var(--kt-pub-ink-accent)]">
                {item.icon}
              </span>
              <h3 className="text-base font-bold text-[var(--kt-pub-ink-strong)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kt-pub-ink-muted)]">
                {item.desc}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default Home
