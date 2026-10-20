import { BsPaperclip } from 'react-icons/bs'
import { API_BASE_URL } from '../config/api'
import {
  dashboardMutedColor,
  modalSectionTitle,
  dashboardBorderColor,
  dashboardTextColor
} from '../Styles/common'

export default function CardAttachments({ attachments }) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BsPaperclip className={`${dashboardMutedColor} text-sm`} />
        <h3 className={modalSectionTitle}>Attachments</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {attachments.map((item, index) => {
          const source = item._id ? `${API_BASE_URL}/projects-api/attachments/${item._id}` : item.url
          return (
            <a
              key={`${source}-${index}`}
              href={source}
              target="_blank"
              rel="noreferrer"
              className={`block overflow-hidden rounded-lg bg-[#18181b] border ${dashboardBorderColor}`}
            >
              <img
                src={source}
                alt={item.name || 'Card attachment'}
                loading="lazy"
                className="h-24 w-full object-cover"
              />
              <span
                className={`block truncate px-2 py-1 text-[11px] ${dashboardTextColor}`}
              >
                {item.name || 'Image attachment'}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
