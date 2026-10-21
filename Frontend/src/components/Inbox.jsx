import { useNavigate } from 'react-router-dom'
import {
  BsArrowRight,
  BsBell,
  BsCheck2Circle,
  BsKanban,
  BsPencilSquare
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
    title: 'Manual entry only',
    text: 'Work enters Kanvora when you add a card on a board. Inbox does not read email, Slack, or any external tool.',
    icon: <BsPencilSquare />
  },
  {
    title: 'Open the real notification list',
    text: 'Use Notifications to review board updates, mentions, and invitations in one place.',
    icon: <BsBell />
  },
  {
    title: 'Boards stay the source of truth',
    text: 'Open the dashboard to work with the lists and cards that hold the actual work.',
    icon: <BsKanban />
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
            Inbox overview
          </p>
          <h1
            className={`mt-3 text-4xl font-bold tracking-tight ${primaryText} sm:text-5xl`}
          >
            A lightweight overview, not an external inbox.
          </h1>
          <p className={`mt-5 max-w-xl text-base leading-7 ${mutedText}`}>
            Inbox is a local Kanvora overview surface. It is not connected to
            external email, Slack, or another capture service. To add work, open
            a board and create a card.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              className={buttonPrimary}
              onClick={() => navigate('/main-page')}
            >
              Open dashboard <BsArrowRight />
            </button>
            <button
              className={buttonSecondary}
              onClick={() => navigate('/main-page/notifications')}
            >
              Open notifications
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-6 shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-[#ff8aa0]">
            Connection status
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/85">
            <li>External email: not connected</li>
            <li>Slack or chat capture: not connected</li>
            <li>Calendar sync: not connected</li>
            <li>Notifications: available at /main-page/notifications</li>
          </ul>
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
        <h2 className="text-3xl font-bold">Where the work actually lives</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Kanvora keeps work on boards, lists, and cards. Use the dashboard for
          the active workspace and Notifications for updates.
        </p>
        <button
          className="premium-button-glow mt-7 rounded-lg bg-[#ff4d67] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#ff6b82]"
          onClick={() => navigate('/main-page')}
        >
          Open dashboard
        </button>
      </section>
    </main>
  )
}

export default Inbox
