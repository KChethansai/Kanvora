// CustomerStories component: illustrative board examples, not customer testimonials.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BsKanban } from 'react-icons/bs'
import {
  surfaceBg,
  primaryText,
  mutedText,
  defaultBorderColor,
  accentBg,
  accentText
} from '../Styles/common'

const industries = [
  'All',
  'Engineering',
  'Design',
  'Marketing',
  'Operations',
  'Education'
]

const examples = [
  {
    id: 1,
    industry: 'Engineering',
    title: 'Sprint planning board',
    summary:
      'A team keeps sprint work in one board and moves cards through the stages it actually uses.',
    lists: ['Backlog', 'In Progress', 'Review', 'Done'],
    practice:
      'Cards carry owners, due dates, labels, comments, and checklists so the sprint conversation stays with the work.'
  },
  {
    id: 2,
    industry: 'Design',
    title: 'Design request board',
    summary:
      'Requests arrive as cards, get sized with labels, and keep review notes in comments.',
    lists: ['Requests', 'In Design', 'Review', 'Approved'],
    practice:
      'JPEG or PNG references can be attached to a card, and checklists track the steps before handoff.'
  },
  {
    id: 3,
    industry: 'Marketing',
    title: 'Campaign checklist board',
    summary:
      'A campaign board tracks copy, assets, and approvals without a separate status document.',
    lists: ['Ideas', 'Writing', 'Assets', 'Scheduled'],
    practice:
      'Comments hold decisions, while due dates and labels make upcoming work easy to scan.'
  },
  {
    id: 4,
    industry: 'Operations',
    title: 'Weekly operations board',
    summary:
      'Recurring operational work lives in lists that match the team’s weekly rhythm.',
    lists: ['This Week', 'Waiting', 'Done'],
    practice:
      'Checklists keep repeatable steps consistent, and workspace roles control who can edit the board.'
  },
  {
    id: 5,
    industry: 'Education',
    title: 'Class project board',
    summary:
      'A class group splits project work into lists and uses cards for each deliverable.',
    lists: ['To Do', 'In Progress', 'Review', 'Submitted'],
    practice:
      'Comments and mentions keep questions attached to the task instead of scattered across chat.'
  },
  {
    id: 6,
    industry: 'Engineering',
    title: 'Release readiness board',
    summary:
      'A release board tracks the checks that must pass before a team ships.',
    lists: ['Planned', 'Testing', 'Ready', 'Shipped'],
    practice:
      'Labels mark risk areas, checklists list release steps, and due dates show what is next.'
  }
]

function CustomerStories() {
  const navigate = useNavigate()
  const [activeIndustry, setActiveIndustry] = useState('All')
  const [activeStory, setActiveStory] = useState(examples[0])

  const filtered =
    activeIndustry === 'All'
      ? examples
      : examples.filter((example) => example.industry === activeIndustry)

  return (
    <main className={`${surfaceBg}`}>
      {/* hero */}
      <div className="bg-linear-to-br from-[var(--kt-pub-teal-950)] to-[var(--kt-pub-accent-strong)] py-24 px-6 text-center">
        <h1 className="text-5xl font-bold on-scrim mb-5">Example Workflows</h1>
        <p className="on-scrim text-lg max-w-2xl mx-auto">
          Illustrative board examples, not customer testimonials. Kanvora does
          not currently publish customer stories or verified customer metrics.
        </p>
      </div>

      {/* featured example */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div
          className={`rounded-3xl bg-linear-to-br ${activeStory.id % 2 ? 'from-[var(--kt-pub-chip)] to-[var(--kt-pub-cyan-600)]' : 'from-[var(--kt-pub-cyan-500)] to-[var(--kt-pub-accent)]'} p-1 shadow-xl`}
        >
          <div
            className={`${surfaceBg} rounded-[22px] p-10 flex flex-col md:flex-row gap-10 items-center`}
          >
            <div className="flex-1">
              <p className="mb-4 inline-flex rounded-full border border-[var(--kt-pub-chip)]/40 bg-[var(--kt-pub-chip)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--kt-accent-text)]">
                Illustrative example
              </p>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText} mb-2`}>
                {activeStory.industry}
              </p>
              <h2 className={`text-3xl ${primaryText} leading-tight mb-4`}>
                {activeStory.title}
              </h2>
              <p className={`${mutedText} leading-relaxed mb-6`}>
                {activeStory.summary}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeStory.lists.map((list) => (
                  <span
                    key={list}
                    className="rounded-full border border-[var(--kt-pub-chip)]/30 bg-[var(--kt-pub-chip)]/10 px-3 py-1 text-xs font-semibold text-[var(--kt-accent-text)]"
                  >
                    {list}
                  </span>
                ))}
              </div>
            </div>
            <div
              className={`md:border-l md:${defaultBorderColor} md:pl-10 max-w-sm`}
            >
              <BsKanban className="text-3xl text-[var(--kt-accent-text)] mb-3" />
              <p className={`${mutedText} text-sm leading-relaxed`}>
                {activeStory.practice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* industry filter */}
      <div className="max-w-6xl mx-auto px-6 mb-6">
        <div className="flex gap-2 flex-wrap">
          {industries.map((ind) => (
            <button type="button"
              key={ind}
              onClick={() => setActiveIndustry(ind)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeIndustry === ind
                  ? `${accentBg} text-[var(--kt-pub-on-fill)]`
                  : 'bg-[var(--kt-surface-soft)] text-[var(--kt-text)]'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* example cards grid */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((story) => (
            <button
              type="button"
              key={story.id}
              onClick={() => setActiveStory(story)}
              className={`rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-2 text-left ${
                activeStory.id === story.id
                  ? defaultBorderColor
                  : 'border-transparent'
              }`}
            >
              <div className="h-3 bg-linear-to-r from-[var(--kt-pub-fill-400)] to-[var(--kt-pub-cyan-500)]" />
              <div className={`${surfaceBg} p-6`}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--kt-accent-text)]">
                  Illustrative example
                </span>
                <h3 className={`mt-2 text-lg font-bold ${primaryText}`}>
                  {story.title}
                </h3>
                <p
                  className={`${mutedText} text-sm leading-relaxed mt-2 line-clamp-3`}
                >
                  {story.summary}
                </p>
                <p className={`mt-4 text-xs font-semibold ${mutedText}`}>
                  {story.lists.join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* cta */}
      <div className={`${accentBg} py-16 px-6 text-center`}>
        <h2 className="text-4xl font-bold on-accent mb-4">
          Shape a board around your own workflow
        </h2>
        <p className="on-accent text-lg mb-8 max-w-xl mx-auto">
          Start from a published template or build lists that match the way your
          team already works.
        </p>
        <button type="button"
          onClick={() => navigate('/templates')}
          className={`${surfaceBg} ${accentText} font-bold px-8 py-3.5 rounded-xl hover:bg-[var(--kt-pub-blue-50)] transition-colors`}
        >
          Browse templates
        </button>
      </div>
    </main>
  )
}

export default CustomerStories
