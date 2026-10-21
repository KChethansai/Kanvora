import {
  BsX,
  BsHeart,
  BsHeartFill,
  BsPerson,
  BsCalendar3,
  BsBoxArrowUpRight,
  BsPencil
} from 'react-icons/bs'
import useDialogFocus from '../hooks/useDialogFocus'
import {
  successBg,
  accentBg,
  errorText,
  errorBg,
  errorBgHover,
  dashboardMutedColor,
  dashboardBgColor,
  dashboardPrimaryBg,
  dashboardPrimaryBgHover,
  dashboardPrimaryText,
  dashboardSurfaceColor,
  dashboardSurfaceHover,
  dashboardTextColor,
  dashboardBorderColor
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

export default function TemplateDetailPanel({
  template,
  onClose,
  isOwner,
  onUse,
  onEdit,
  onDelete,
  onToggleFav
}) {
  const dialogRef = useDialogFocus(true, onClose)
  const linear = cardLinear(template.title)

  const formattedDate = template.createdAt
    ? new Date(template.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-detail-title"
        tabIndex={-1}
        className="premium-card fixed right-0 top-0 h-full w-full max-w-[420px] z-40 border-l border-white/[0.08] flex flex-col animate-slide-in focus:outline-none"
      >
        {/* hero */}
        <div className="relative h-44 shrink-0">
          {template.images?.[0] ? (
            <img
              src={template.images[0]}
              alt={template.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${linear}`} />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template details"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <BsX size={18} />
          </button>
          <div className="absolute bottom-3 left-3 flex gap-2">
            {template.isPublished && (
              <span
                className={`${successBg} text-white text-[10px] px-2 py-1 rounded-full font-bold`}
              >
                PUBLISHED
              </span>
            )}
            {template.type === 'project' && (
              <span
                className={`${accentBg} text-white text-[10px] px-2 py-1 rounded-full font-bold`}
              >
                PROJECT
              </span>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2
              id="template-detail-title"
              className="text-white text-xl font-bold leading-snug"
            >
              {template.title}
            </h2>
            <button
              type="button"
              onClick={() => onToggleFav(template._id)}
              aria-pressed={Boolean(template.favourite)}
              aria-label={
                template.favourite
                  ? 'Remove from favourites'
                  : 'Add to favourites'
              }
              className={`shrink-0 w-8 h-8 rounded-lg ${dashboardBgColor} flex items-center justify-center ${dashboardSurfaceHover} transition-colors`}
            >
              {template.favourite ? (
                <BsHeartFill className={`${errorText} text-sm`} />
              ) : (
                <BsHeart className={`${dashboardMutedColor} text-sm`} />
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <span
              className={`flex items-center gap-1.5 ${dashboardMutedColor} text-xs`}
            >
              <BsPerson size={12} />
              {template.creatorName}
            </span>
            {formattedDate && (
              <span
                className={`flex items-center gap-1.5 ${dashboardMutedColor} text-xs`}
              >
                <BsCalendar3 size={11} />
                {formattedDate}
              </span>
            )}
            <span
              className={`${dashboardBgColor} px-2 py-0.5 rounded text-[10px] ${dashboardMutedColor}`}
            >
              {template.category}
            </span>
          </div>

          {template.description ? (
            <p className={`${dashboardTextColor} text-sm leading-relaxed mb-6`}>
              {template.description}
            </p>
          ) : (
            <p className="text-[#6b7280] text-sm italic mb-6">
              No description provided.
            </p>
          )}

          {/* what using this template actually does */}
          <div
            className={`rounded-xl border ${dashboardBorderColor} ${dashboardBgColor} p-4 mb-6`}
          >
            <p
              className={`text-xs ${dashboardMutedColor} font-medium mb-2 uppercase tracking-wide`}
            >
              What you get
            </p>
            <p className={`text-sm ${dashboardTextColor} leading-relaxed`}>
              A new board of your own with To Do, In Progress and Done lists.
              Tasks, comments, members and publisher details from the source are
              not copied.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onUse(template)}
            className={`w-full h-11 rounded-xl ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} ${dashboardPrimaryText} font-semibold text-sm transition-colors flex items-center justify-center gap-2`}
          >
            <BsBoxArrowUpRight size={14} />
            Use template
          </button>

          {/* owner actions */}
          {isOwner && (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => onEdit(template)}
                className={`flex-1 h-9 rounded-lg ${dashboardSurfaceColor} ${dashboardSurfaceHover} ${dashboardMutedColor} hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2`}
              >
                <BsPencil size={13} /> Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(template._id)}
                className={`flex-1 h-9 rounded-lg ${errorBg} ${errorBgHover} ${errorText} text-sm font-medium transition-colors flex items-center justify-center gap-2`}
              >
                <BsX size={16} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </>
  )
}
