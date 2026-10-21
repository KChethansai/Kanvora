import { BsTag } from 'react-icons/bs'
import {
  projectInput,
  projectPrimarySmallBtn,
  dashboardMutedColor,
  modalSectionTitle
} from '../Styles/common'
import {
  LABEL_COLOR_VALUES,
  LABEL_PRESETS,
  getLabelColorClass
} from '../utils/projectUtils'

export function CardLabelsInput({
  labelText,
  setLabelText,
  showLabels,
  selectedLabelColor,
  setSelectedLabelColor,
  addLabel,
  readOnly
}) {
  return (
    <label className={`text-xs ${dashboardMutedColor}`}>
      Labels
      <div className="mt-1 flex gap-2">
        <input
          value={labelText}
          onChange={(e) => setLabelText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLabel()}
          readOnly={readOnly}
          className={projectInput}
          placeholder="Add label"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={addLabel}
            className={projectPrimarySmallBtn}
          >
            Add
          </button>
        )}
      </div>
      {!readOnly && showLabels && (
        <div className="mt-2 flex flex-wrap gap-1">
          {LABEL_COLOR_VALUES.map((value, index) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedLabelColor(value)}
              className={`h-6 w-6 rounded-full ${LABEL_PRESETS[index]} ${
                selectedLabelColor === value
                  ? 'ring-2 ring-white'
                  : ''
              }`}
              aria-label={`Choose ${value} label`}
            />
          ))}
        </div>
      )}
    </label>
  )
}

export function CardLabelsList({ labels, nonStatusLabels, removeLabel, readOnly }) {
  if (!labels || labels.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BsTag className={`${dashboardMutedColor} text-sm`} />
        <h3 className={modalSectionTitle}>Labels</h3>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {nonStatusLabels.map((label, i) => (
          <span
            key={i}
            onClick={() => !readOnly && removeLabel(i)}
            className={`text-xs px-3 py-1 rounded-full font-semibold on-scrim ${getLabelColorClass(label.color)} ${readOnly ? '' : 'cursor-pointer'}`}
          >
            {label.text}
            {!readOnly && <span className="ml-1">x</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
