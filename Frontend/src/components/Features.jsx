// Features component: pre-login marketing page.
import { useNavigate } from 'react-router-dom'
import { BsCalendar3, BsGrid3X3Gap, BsInbox, BsBell, BsQuestionCircle } from 'react-icons/bs'

const featuresData = [
  {
    title: 'Inbox',
    desc: 'A lightweight local overview of incoming work. It does not connect to email, Slack, or other external tools.',
    icon: <BsInbox />,
    path: '/inbox'
  },
  {
    title: 'Planner',
    desc: 'A lightweight planning overview. It does not sync Google Calendar, Outlook, or any external calendar.',
    icon: <BsCalendar3 />,
    path: '/planner'
  },
  {
    title: 'Templates',
    desc: 'Start a new board from a published template. The board gets To Do, In Progress, and Done lists; cards, comments, and members are not copied.',
    icon: <BsGrid3X3Gap />,
    path: '/templates'
  }
]

const productLinks = [
  { label: 'Dashboard', path: '/main-page', icon: <BsGrid3X3Gap /> },
  { label: 'Notifications', path: '/main-page/notifications', icon: <BsBell /> },
  { label: 'Help center', path: '/help', icon: <BsQuestionCircle /> }
]

function Features() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[var(--kt-pub-bg)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[var(--kt-pub-wash)] via-[var(--kt-pub-surface)] to-[var(--kt-pub-cyan-50)]/50 py-20 px-6 border-b border-[var(--kt-pub-line)]">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-5xl font-bold text-[var(--kt-pub-ink)] mb-5 leading-tight tracking-tight">
            Kanvora Features For Focused Teams
          </h1>
          <p className="text-lg text-[var(--kt-pub-ink-muted)] max-w-2xl leading-relaxed">
            Boards with lists, cards, labels, comments, checklists, attachments,
            templates, and workspaces with roles — in one calm, focused
            workspace.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuresData.map((f) => (
            <button
              key={f.title}
              type="button"
              onClick={() => navigate(f.path)}
              className="rounded-2xl overflow-hidden border border-[var(--kt-pub-line)] bg-[var(--kt-pub-surface)] hover:border-[var(--kt-pub-line-focus)] transition-all duration-300 hover:-translate-y-1.5 cursor-pointer group shadow-sm hover:shadow-lg flex flex-col text-left"
            >
              <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[var(--kt-pub-wash)] to-[var(--kt-pub-cyan-50)] text-6xl text-[var(--kt-pub-ink-accent)]">
                {f.icon}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h2 className="font-bold text-xl mb-3 tracking-tight text-[var(--kt-pub-ink-strong)] group-hover:text-[var(--kt-pub-ink)] transition-colors underline">
                  {f.title}
                </h2>
                <p className="text-[var(--kt-pub-ink-muted)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {productLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--kt-pub-line-strong)] bg-[var(--kt-pub-surface)] px-4 py-2 text-sm font-semibold text-[var(--kt-pub-ink-muted)] transition-colors hover:border-[var(--kt-pub-line-accent)] hover:text-[var(--kt-pub-ink-strong)]"
            >
              {link.icon} {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Features
