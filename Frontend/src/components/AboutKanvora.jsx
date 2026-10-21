// AboutKanvora component: renders a focused piece of the Kanvora UI.
import { useNavigate } from 'react-router-dom'
import {
  surfaceBg,
  accentBg,
  primaryText,
  mutedText,
  pageBg,
  accentBgHover
} from '../Styles/common'

const facts = [
  { value: 'Boards', label: 'Lists and cards' },
  { value: 'Labels', label: 'Status and categories' },
  { value: 'Checklists', label: 'Break work into steps' },
  { value: 'Templates', label: 'Start with structure' }
]

const values = [
  {
    icon: '01',
    title: 'Collaboration first',
    desc: 'Boards, comments, mentions, checklists, and shared workspaces keep work visible to the people doing it.'
  },
  {
    icon: '02',
    title: 'Simplicity is power',
    desc: 'Kanvora keeps the core workflow to boards, lists, and cards so teams can focus on the work itself.'
  },
  {
    icon: '03',
    title: 'Built for small teams',
    desc: 'Kanvora is built for small teams and student groups that need a clear board without a large setup.'
  },
  {
    icon: '04',
    title: 'Access follows membership',
    desc: 'Workspace roles decide who can manage boards, invite members, or view work read-only.'
  }
]

const team = [
  {
    name: 'K.ChethanSai',
    role: 'Front-End',
    avatar: 'C',
    color: 'from-[var(--kt-pub-blue-400)] to-[var(--kt-pub-blue-600)]'
  },
  {
    name: 'AdityaMurthi',
    role: 'Front-End',
    avatar: 'AM',
    color: 'from-[var(--kt-pub-fill-400)] to-[var(--kt-pub-cyan-600)]'
  },
  {
    name: 'Nithish',
    role: 'Back-End',
    avatar: 'N',
    color: 'from-[var(--kt-pub-violet-400)] to-purple-600'
  },
  {
    name: 'Sreeman',
    role: 'Back-End',
    avatar: 'S',
    color: 'from-[var(--kt-pub-pink-400)] to-[var(--kt-pub-rose-500)]'
  },
  {
    name: 'Samanvi',
    role: 'Back-End',
    avatar: 'S',
    color: 'from-[var(--kt-pub-pink-400)] to-[var(--kt-pub-rose-500)]'
  }
]

function AboutKanvora() {
  const navigate = useNavigate()

  return (
    <main className="bg-[var(--kt-pub-bg)]">
      {/* hero */}
      <div className="bg-linear-to-br from-[var(--kt-pub-hero-from)] via-[var(--kt-pub-hero-via)] to-[var(--kt-pub-hero-to)] py-24 px-6 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold on-scrim mb-6 leading-tight break-words text-balance">
          About Kanvora
        </h1>
        <p className="on-scrim-muted text-xl max-w-2xl mx-auto leading-relaxed">
          Kanvora is a board-based workspace for teams that want their lists,
          cards, comments, and decisions in one visible place.
        </p>
      </div>

      {/* facts */}
      <div className="bg-[var(--kt-pub-accent)] py-14 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {facts.map((fact) => (
            <div key={fact.label}>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--kt-pub-accent-ink)] mb-1">{fact.value}</p>
              <p className="text-[var(--kt-pub-accent-ink)] text-sm font-medium">{fact.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* story */}
      <div className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className={`text-4xl font-bold ${primaryText} mb-6`}>
            What Kanvora is
          </h2>
          <p className={`${mutedText} text-lg leading-relaxed mb-6`}>
            Kanvora gives a team boards made of lists and cards. Each card can
            hold a description, due date, labels, checklists, comments, and image
            attachments, so the details stay next to the work instead of in a
            separate thread.
          </p>
          <p className={`${mutedText} text-lg leading-relaxed mb-6`}>
            Workspaces group boards and members. Roles decide who can manage
            boards, invite people, or view work read-only, and notifications keep
            updates in one list.
          </p>
          <p className={`${mutedText} text-lg leading-relaxed`}>
            Kanvora does not currently offer email or calendar sync, AI features,
            or a built-in automation engine. The product focuses on the board
            workflow described here.
          </p>
        </div>
      </div>

      {/* values */}
      <div className={`${pageBg} py-20 px-6`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-4xl font-bold ${primaryText} text-center mb-12`}>
            What we stand for
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v) => (
              <div
                key={v.title}
                className="premium-card premium-card-hover rounded-2xl p-8"
              >
                <span className="text-4xl mb-4 block">{v.icon}</span>
                <h3 className={`text-xl font-bold ${primaryText} mb-2`}>
                  {v.title}
                </h3>
                <p className={`${mutedText} leading-relaxed`}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* team */}
      <div className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className={`text-4xl font-bold ${primaryText} text-center mb-4`}>
            Meet the team
          </h2>
          <p className={`text-center ${mutedText} mb-12`}>
            The people behind Kanvora&apos;s vision.
          </p>
          <div className="flex flex-wrap justify-center gap-10">
            {team.map((member) => (
              <div key={member.name} className="flex flex-col items-center text-center w-40">
                <div
                  aria-hidden="true"
                  className={`w-20 h-20 rounded-full bg-linear-to-br ${member.color} flex items-center justify-center text-[var(--kt-pub-on-fill)] font-bold text-xl mb-3 shadow-lg`}
                >
                  {member.avatar}
                </div>
                <p className={`font-semibold ${primaryText}`}>{member.name}</p>
                <p className={`text-sm ${mutedText}`}>{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* cta */}
      <div className={`${pageBg} py-16 px-6`}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <h2 className={`text-3xl font-bold ${primaryText} mb-4`}>
              Start with a board
            </h2>
            <p className={`${mutedText} leading-relaxed mb-4`}>
              Create a workspace, add a board, and shape lists around the stages
              your team already uses. You can start from a template or from an
              empty board.
            </p>
            <button type="button"
              onClick={() => navigate('/register')}
              className={`${accentBg} text-[var(--kt-pub-on-fill)] px-6 py-3 rounded-xl font-semibold ${accentBgHover} transition-colors`}
            >
              Try Kanvora
            </button>
          </div>
          <div className={`flex-1 rounded-2xl border border-[var(--kt-pub-line)] ${surfaceBg} p-6`}>
            <ul className={`space-y-3 text-sm ${mutedText}`}>
              <li>Boards, lists, cards, labels, and drag-and-drop ordering</li>
              <li>Comments, checklists, due dates, and image attachments</li>
              <li>Workspaces with roles, invitations, and notifications</li>
              <li>Published templates and a help center</li>
            </ul>
          </div>
        </div>
      </div>
    
    </main>
  )
}

export default AboutKanvora
