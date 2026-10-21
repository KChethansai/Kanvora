// TeamManagement component: pre-login marketing page for team workflows.
import { useNavigate } from 'react-router-dom'
import {
  BsCalendarCheck,
  BsFolder2Open,
  BsKanban,
  BsPeople
} from 'react-icons/bs'

const featuresData = [
  {
    icon: <BsKanban />,
    title: 'Project Management',
    desc: 'Plan work on boards with lists and cards. Add owners, labels, due dates, and checklists as the project takes shape.'
  },
  {
    icon: <BsCalendarCheck />,
    title: 'Team Meetings',
    desc: 'Keep an agenda and action items as cards. Add comments for decisions and checklists for follow-ups.'
  },
  {
    icon: <BsFolder2Open />,
    title: 'Team Organization',
    desc: 'Use boards for schedules, FAQs, and project summaries, with image attachments for reference material.'
  }
]

function TeamManagement() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f0fdfa]">
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 px-6 py-16 on-scrim">
        <div className="mx-auto max-w-6xl">
          <button
            className="text-sm font-light underline underline-offset-4"
            onClick={() => navigate('/solutions')}
          >
            Back to solutions
          </button>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight">
            Kanvora for Team Management
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed">
            From project planning to meeting follow-ups, keep the work in one
            board your team can see. Kanvora provides lists, cards, comments,
            checklists, and workspace roles.
          </p>
          <button
            className="mt-8 rounded-xl bg-white px-6 py-3 font-semibold text-teal-700 transition-colors hover:bg-teal-50"
            onClick={() => navigate('/register')}
          >
            Start with a board
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-teal-900">
          Workspaces for teams of all sizes
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center leading-relaxed text-teal-700">
          Create a workspace, invite members by email, and shape boards around
          the way your team works. Roles decide who can manage boards, invite
          people, or view work read-only.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {featuresData.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-xl text-teal-600">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-lg font-bold text-teal-800">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-teal-700">
                {feature.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-teal-100 bg-teal-50 px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-teal-900">
              Members, roles, and notifications
            </h2>
            <p className="mt-4 leading-relaxed text-teal-700">
              The Members view lists everyone in the active workspace and the
              role each person holds. Owners manage the workspace and its
              permissions; Managers and Members can create and edit boards;
              Viewers have read-only access.
            </p>
            <p className="mt-4 leading-relaxed text-teal-700">
              Notifications collect board updates, mentions, and invitations in
              one list.
            </p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
            <BsPeople className="text-2xl text-teal-600" />
            <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-800">
              <li>Invite members by email; invitations expire after 7 days</li>
              <li>Change a member’s role or remove them from Members</li>
              <li>Review updates and project invitations in Notifications</li>
              <li>Manage boards with workspace roles and permissions</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl border border-teal-100 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold tracking-tight text-teal-900">
            Start from a board or a template
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-teal-700">
            A template creates a new board with To Do, In Progress, and Done
            lists. Cards, comments, members, and attachments are not copied.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/templates')}
              className="rounded-xl bg-teal-700 px-5 py-2.5 font-semibold on-scrim transition-colors hover:bg-teal-800"
            >
              Browse templates
            </button>
            <button
              onClick={() => navigate('/help')}
              className="rounded-xl border border-teal-200 px-5 py-2.5 font-semibold text-teal-700 transition-colors hover:border-teal-400"
            >
              Read the help center
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default TeamManagement
