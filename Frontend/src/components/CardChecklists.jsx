import { BsCheckSquare, BsX } from 'react-icons/bs'
import {
  dashboardMutedColor,
  modalSectionTitle,
  badgeText,
  progressTrack,
  progressFill,
  dashboardBorderColor,
  dashboardTextColor,
  commonCheckbox,
  projectInput,
  projectPrimarySmallBtn
} from '../Styles/common'

export default function CardChecklists({
  cardId,
  checklists,
  setChecklists,
  newChecklistItemTitles,
  setNewChecklistItemTitles,
  onQuickUpdate,
  readOnly
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BsCheckSquare className={`${dashboardMutedColor} text-sm`} />
        <h3 className={modalSectionTitle}>Checklist</h3>
      </div>
      {checklists.map((checklist, checklistIndex) => {
        const done = (checklist.items || []).filter(
          (i) => i.completed
        ).length
        const total = (checklist.items || []).length
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return (
          <div key={checklistIndex} className="mb-4">
            {/* checklist title + progress */}
            <div className="flex items-center gap-2 mb-1.5">
              <input
                value={checklist.title}
                onChange={(e) => {
                  const val = e.target.value
                  const next = checklists.map((entry, idx) =>
                    idx === checklistIndex
                      ? { ...entry, title: val }
                      : entry
                  )
                  setChecklists(next)
                  onQuickUpdate?.(cardId, { checklists: next })
                }}
                readOnly={readOnly}
                className={`${projectInput} flex-1`}
                placeholder="Checklist name"
              />
              {total > 0 && (
                <span className={badgeText}>
                  {done}/{total}
                </span>
              )}
            </div>
            {/* progress bar */}
            {total > 0 && (
              <div className={`mb-2 ${progressTrack}`}>
                <div
                  className={progressFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {/* items */}
            <div className="space-y-1 mt-2">
              {(checklist.items || []).map((item, itemIndex) => (
                <label
                  key={`${item.title}-${itemIndex}`}
                  className={`group flex items-center gap-3 rounded-lg border ${dashboardBorderColor} bg-white/2 px-3 py-2 text-sm ${dashboardTextColor} cursor-pointer hover:bg-white/5 transition-colors`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.completed)}
                    disabled={readOnly}
                    className={`app-native-checkbox ${commonCheckbox}`}
                    onChange={(e) => {
                      const checked = e.target.checked
                      const next = checklists.map((entry, idx) =>
                        idx === checklistIndex
                          ? {
                              ...entry,
                              items: entry.items.map(
                                (checkItem, checkIdx) =>
                                  checkIdx === itemIndex
                                    ? {
                                        ...checkItem,
                                        completed: checked
                                      }
                                    : checkItem
                              )
                            }
                          : entry
                      )
                      setChecklists(next)
                      onQuickUpdate?.(cardId, { checklists: next })
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
                        const next = checklists.map((entry, idx) =>
                          idx === checklistIndex
                            ? {
                                ...entry,
                                items: entry.items.filter(
                                  (_, ci) => ci !== itemIndex
                                )
                              }
                            : entry
                        )
                        setChecklists(next)
                        onQuickUpdate?.(cardId, {
                          checklists: next
                        })
                      }}
                      className={`ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 ${dashboardMutedColor} hover:text-[#ff8aa0] transition-all`}
                      aria-label="Remove item"
                    >
                      <BsX className="text-lg" />
                    </button>
                  )}
                </label>
              ))}
              {/* add item input */}
              {!readOnly && (
                <div className="flex gap-2 mt-1.5">
                  <input
                    value={
                      newChecklistItemTitles[checklistIndex] || ''
                    }
                    onChange={(e) =>
                      setNewChecklistItemTitles((prev) => ({
                        ...prev,
                        [checklistIndex]: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      const val =
                        newChecklistItemTitles[checklistIndex]?.trim()
                      if (e.key === 'Enter' && val) {
                        const next = checklists.map((entry, idx) =>
                          idx === checklistIndex
                            ? {
                                ...entry,
                                items: [
                                  ...(entry.items || []),
                                  { title: val, completed: false }
                                ]
                              }
                            : entry
                        )
                        setChecklists(next)
                        onQuickUpdate?.(cardId, {
                          checklists: next
                        })
                        setNewChecklistItemTitles((prev) => ({
                          ...prev,
                          [checklistIndex]: ''
                        }))
                      }
                    }}
                    placeholder="Add an item..."
                    className={projectInput}
                  />
                  <button
                    type="button"
                    disabled={
                      !newChecklistItemTitles[checklistIndex]?.trim()
                    }
                    onClick={() => {
                      const val =
                        newChecklistItemTitles[checklistIndex]?.trim()
                      if (!val) return
                      const next = checklists.map((entry, idx) =>
                        idx === checklistIndex
                          ? {
                              ...entry,
                              items: [
                                ...(entry.items || []),
                                { title: val, completed: false }
                              ]
                            }
                          : entry
                      )
                      setChecklists(next)
                      onQuickUpdate?.(cardId, { checklists: next })
                      setNewChecklistItemTitles((prev) => ({
                        ...prev,
                        [checklistIndex]: ''
                      }))
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
      })}
    </div>
  )
}
