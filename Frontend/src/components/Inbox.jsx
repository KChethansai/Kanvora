import { useNavigate } from 'react-router-dom'
import {
  BsArrowRight,
  BsCheck2Circle,
  BsEnvelope,
  BsKanban,
  BsLightning
} from 'react-icons/bs'
import {
  accentText,
  buttonPrimary,
  buttonSecondary,
  mutedText,
  primaryText,
  publicCard
} from '../Styles/common'

const features = [
  {
    title: 'Instant capture',
    text: 'Collect ideas, tasks, and follow-ups before they disappear into messages or notes.',
    icon: <BsEnvelope />
  },
  {
    title: 'Organize into boards',
    text: 'Move captured work into the right project when you are ready to plan.',
    icon: <BsKanban />
  },
  {
    title: 'Stay in motion',
    text: 'Mark quick work done, promote larger work into cards, and keep priorities visible.',
    icon: <BsLightning />
  }
]

function Inbox() {
  const navigate = useNavigate()

  return (
    <main className="premium-app-bg">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p
            className={`text-sm font-bold uppercase tracking-wide ${accentText}`}
          >
            Kanvora Inbox
          </p>
          <h1
            className={`mt-3 text-4xl font-bold tracking-tight ${primaryText} sm:text-5xl`}
          >
            Capture every task before it becomes noise.
          </h1>
          <p className={`mt-5 max-w-xl text-base leading-7 ${mutedText}`}>
            Inbox gives teams a low-friction place to collect incoming work,
            then turn it into organized cards when the timing is right.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              className={buttonPrimary}
              onClick={() => navigate('/register')}
            >
              Try Inbox free <BsArrowRight />
            </button>
            <button
              className={buttonSecondary}
              onClick={() => navigate('/help')}
            >
              See workflow
            </button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-[#ff4d67]/20 blur-3xl" />
          <img
            className="relative w-full rounded-2xl border border-white/[0.08] shadow-2xl"
            src="https://images.ctfassets.net/rz1oowkt5gyp/15yelj0vFDnyOgwyWAZSup/bbdc0dfa821ff9056b2eae8a782c14bf/inbox-hero-updated.png?w=1440&fm=webp"
            alt="Inbox product preview"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className={publicCard}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff4d67]/10 text-xl text-[#ff4d67]">
                {feature.icon}
              </span>
              <h2 className={`mt-5 text-lg font-bold ${primaryText}`}>
                {feature.title}
              </h2>
              <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.08] bg-[#111111] px-4 py-14 text-center text-white">
        <BsCheck2Circle className="mx-auto mb-4 text-3xl" />
        <h2 className="text-3xl font-bold">Ready to simplify intake?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Start capturing incoming work in one place, then turn it into boards,
          checklists, and team-ready cards.
        </p>
        <button
          className="premium-button-glow mt-7 rounded-lg bg-[#ff4d67] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#ff6b82]"
          onClick={() => navigate('/register')}
        >
          Get started
        </button>
      </section>
    </main>
  )
}

export default Inbox
