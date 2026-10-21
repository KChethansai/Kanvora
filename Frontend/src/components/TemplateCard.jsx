import { BsHeart, BsHeartFill } from 'react-icons/bs'
import {
  errorText,
  successBg,
  successInk,
  scrimText,
  dashboardMutedColor,
  dashboardBgColor,
  dashboardPrimaryBg,
  dashboardPrimaryBgHover
} from '../Styles/common'

const linears = [
  'from-blue-500 to-blue-700',
  'from-violet-500 to-purple-700',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-rose-500',
  'from-slate-500 to-slate-700',
  'from-amber-400 to-orange-500',
  'from-teal-400 to-cyan-500'
]

function cardLinear(title) {
  let hash = 0
  for (let i = 0; i < (title || '').length; i++) {
    hash += title.charCodeAt(i)
  }
  return linears[hash % linears.length]
}

export default function TemplateCard({ template, onToggleFav, onClick, onUse }) {
  const linear = cardLinear(template.title)
  const typeLabel = template.type === 'project' ? 'Project board' : 'Template'

  return (
    <div className="premium-card premium-card-hover overflow-hidden rounded-xl">
      <div className="relative h-24">
        {template.images?.[0] ? (
          <img
            src={template.images[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-linear-to-br ${linear}`} />
        )}

        <button
          type="button"
          onClick={() => onToggleFav(template._id)}
          aria-pressed={Boolean(template.favourite)}
          aria-label={
            template.favourite
              ? `Remove ${template.title} from favourites`
              : `Add ${template.title} to favourites`
          }
          className="absolute top-2 right-2 w-7 h-7 rounded bg-black/40 flex items-center justify-center hover:bg-black/60"
        >
          {template.favourite ? (
            <BsHeartFill className={`${errorText} text-xs`} />
          ) : (
            <BsHeart className={`${scrimText} text-xs`} />
          )}
        </button>

        <div className="absolute top-2 left-2 flex gap-1">
          {template.isPublished && (
            <span
              className={`${successBg} ${successInk} text-[9px] px-2 py-1 rounded font-bold`}
            >
              PUBLISHED
            </span>
          )}
          <span className={`bg-black/60 ${scrimText} text-[9px] px-2 py-1 rounded`}>
            {typeLabel}
          </span>
        </div>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => onClick(template)}
          className="block w-full truncate text-left text-sm font-semibold text-white"
        >
          {template.title}
        </button>
        <p className={`${dashboardMutedColor} text-xs`}>
          by {template.creatorName}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`${dashboardBgColor} px-2 py-1 rounded text-[10px] ${dashboardMutedColor}`}
          >
            {template.category}
          </span>
          <button
            type="button"
            onClick={() => onUse(template)}
            aria-label={`Use template ${template.title}`}
            className={`${dashboardPrimaryBg} ${dashboardPrimaryBgHover} on-accent rounded px-2.5 py-1 text-[11px] font-semibold transition-colors`}
          >
            Use
          </button>
        </div>
      </div>
    </div>
  )
}
