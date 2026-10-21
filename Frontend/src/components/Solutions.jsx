// Solutions component: pre-login marketing page.
import { useNavigate } from 'react-router-dom'

const solutionsCards = [
  {
    title: 'Engineering',
    desc: 'Plan sprints, track bug fixes, and keep release checks on boards with labels, checklists, and comments.',
    path: '/engineering'
  },
  {
    title: 'Design',
    desc: 'Collect requests, attach reference images, and keep review notes next to the work.',
    path: '/design'
  },
  {
    title: 'Personal Productivity',
    desc: 'Use boards and cards for personal planning, with due dates and checklists.',
    path: '/main-page'
  },
  {
    title: 'Team Management',
    desc: 'Coordinate projects, meetings, and team resources in a workspace with roles and notifications.',
    path: '/team-management'
  }
]

function Solutions() {
  const navigate = useNavigate()

  return (
    <div className="bg-[#f0fdfa]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-50 via-white to-cyan-50/50 py-20 px-6 border-b border-teal-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="text-5xl font-bold text-teal-900 mb-5 leading-tight tracking-tight">
              Kanvora Solutions For All Teams
            </h1>
            <p className="text-lg text-teal-700 mb-8 leading-relaxed">
              Boards, lists, cards, comments, checklists, templates, and
              workspaces with roles. Choose a team type to see how those pieces
              fit together.
            </p>
          </div>
          <div className="flex-1 rounded-2xl border border-teal-100 bg-white p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
              Included in Kanvora
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold text-teal-800">
              {['Boards', 'Lists', 'Cards', 'Labels', 'Comments', 'Checklists', 'Templates', 'Workspaces'].map(
                (item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2"
                  >
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {solutionsCards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.path)}
              className="rounded-2xl overflow-hidden border border-teal-100 bg-white hover:border-teal-300 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer group shadow-sm hover:shadow-lg flex flex-col text-left"
            >
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-teal-100 via-cyan-50 to-teal-50">
                <span className="text-2xl font-bold tracking-tight text-teal-700">
                  {card.title}
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h2 className="font-bold text-xl mb-3 tracking-tight text-teal-800 group-hover:text-teal-900 transition-colors underline">
                  {card.title}
                </h2>
                <p className="text-teal-700 text-sm leading-relaxed">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Solutions
