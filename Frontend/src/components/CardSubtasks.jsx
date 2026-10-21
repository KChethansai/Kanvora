import { BsCheckSquare, BsX } from 'react-icons/bs'
import {
  dashboardMutedColor,
  modalSectionTitle,
  badgeText,
  dashboardBorderColor,
  dashboardTextColor,
  commonCheckbox,
  projectInput,
  projectPrimarySmallBtn
} from '../Styles/common'

export default function CardSubtasks({
  cardId,
  subtasks,
  setSubtasks,
  newSubtaskTitle,
  setNewSubtaskTitle,
  onQuickUpdate,
  readOnly
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BsCheckSquare className={`${dashboardMutedColor} text-sm`} />
        <h3 className={modalSectionTitle}>Subtasks</h3>
        {subtasks.length > 0 && (
          <span className={`ml-auto ${badgeText}`}>
            {subtasks.filter((s) => s.completed).length}/
            {subtasks.length}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {subtasks.map((item, index) => (
          <label
            key={`${item.title}-${index}`}
            className={`group flex items-center gap-3 rounded-lg border ${dashboardBorderColor} bg-white/2 px-3 py-2 text-sm ${dashboardTextColor} cursor-pointer hover:bg-white/5 transition-colors`}
          >
            <input
              type="checkbox"
              checked={Boolean(item.completed)}
              disabled={readOnly}
              className={commonCheckbox}
              onChange={(e) => {
                const checked = e.target.checked
                const next = subtasks.map((entry, idx) =>
                  idx === index
                    ? { ...entry, completed: checked }
                    : entry
                )
                setSubtasks(next)
                onQuickUpdate?.(cardId, { subtasks: next })
              }}
            />
            <span
              className={
                item.completed
                  ? 'line-through text-[#a3a3ad] opacity-60'
                  : ''
              }
            >
              {item.title}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  const next = subtasks.filter((_, i) => i !== index)
                  setSubtasks(next)
                  onQuickUpdate?.(cardId, { subtasks: next })
                }}
                className={`ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 ${dashboardMutedColor} hover:text-[#ff8aa0] transition-all`}
                aria-label="Remove subtask"
              >
                <BsX className="text-lg" />
              </button>
            )}
          </label>
        ))}
        {!readOnly && (
          <div className="flex gap-2 mt-2">
            <input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                  const next = [
                    ...subtasks,
                    {
                      title: newSubtaskTitle.trim(),
                      completed: false
                    }
                  ]
                  setSubtasks(next)
                  onQuickUpdate?.(cardId, { subtasks: next })
                  setNewSubtaskTitle('')
                }
              }}
              placeholder="Add a subtask..."
              className={projectInput}
            />
            <button
              type="button"
              disabled={!newSubtaskTitle.trim()}
              onClick={() => {
                const next = [
                  ...subtasks,
                  { title: newSubtaskTitle.trim(), completed: false }
                ]
                setSubtasks(next)
                onQuickUpdate?.(cardId, { subtasks: next })
                setNewSubtaskTitle('')
              }}
              className={projectPrimarySmallBtn}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
