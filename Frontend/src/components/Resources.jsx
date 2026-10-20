import { useNavigate } from 'react-router-dom'
import {
  BsArrowRight,
  BsCalendarCheck,
  BsKanban,
  BsLightbulb,
  BsPeople,
  BsShieldCheck
} from 'react-icons/bs'
import { pubBtnPrimary, pubBtnSecondary, pubEyebrow } from '../Styles/common'

const guides = [
  {
    title: 'Project setup guide',
    description:
      'Create a workspace, invite teammates, and shape boards around real delivery stages.',
    icon: <BsKanban />
  },
  {
    title: 'Team collaboration',
    description:
      'Use comments, activity, and roles to keep decisions close to the work.',
    icon: <BsPeople />
  },
  {
    title: 'Planning rituals',
    description:
      'Turn weekly planning, reviews, and standups into repeatable board workflows.',
    icon: <BsCalendarCheck />
  }
]

const resources = [
  'Board templates for product, design, engineering, and student projects',
  'Workspace governance patterns for small teams and class groups',
  'Notification and activity best practices for async collaboration',
  'Checklist examples for assignments, launches, and recurring tasks'
]

function Resources() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#f0fdfa]">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className={pubEyebrow}>Resources</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-teal-900 sm:text-5xl">
              Practical ways to make every board easier to run.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-teal-700">
              Browse playbooks for planning, team coordination, project hygiene,
              and the workflows that make a Kanvora-style workspace feel calm.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/templates')}
                className={pubBtnPrimary}
              >
                Explore templates
              </button>
              <button
                type="button"
                onClick={() => navigate('/help')}
                className={pubBtnSecondary}
              >
                Read the guide
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
            <div className="rounded-xl bg-teal-50 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <BsLightbulb />
                </span>
                <div>
                  <p className="text-sm font-bold text-teal-800">Starter checklist</p>
                  <p className="text-xs text-teal-600">
                    A quick path from blank workspace to useful board.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {resources.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-lg bg-white border border-teal-100 px-3 py-3"
                  >
                    <BsShieldCheck className="mt-0.5 shrink-0 text-teal-500" />
                    <p className="text-sm leading-5 text-teal-800">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Guide cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {guides.map((guide) => (
            <article
              key={guide.title}
              className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                {guide.icon}
              </span>
              <h2 className="mt-5 text-lg font-bold text-teal-800">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-teal-600">{guide.description}</p>
              <button
                type="button"
                onClick={() => navigate('/help')}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                Learn more <BsArrowRight />
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-teal-50 border-t border-teal-100">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 py-12 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-bold text-teal-900">
              Ready to organize the next project?
            </p>
            <p className="mt-1 text-sm text-teal-600">
              Start from a template or open your workspace dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/main-page')}
            className={pubBtnPrimary}
          >
            Open dashboard
          </button>
        </div>
      </section>
    </main>
  )
}

export default Resources
