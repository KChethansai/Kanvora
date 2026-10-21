import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BsArrowLeft, BsHeart, BsHeartFill, BsPencil, BsTrash, BsBoxArrowUpRight } from 'react-icons/bs'
import axios from 'axios'
import toast from 'react-hot-toast'

import { API_BASE_URL } from '../config/api'
import TemplateEditForm from './TemplateEditForm'
import { UseTemplateDialog } from '../utils/templateActions'
import {
  buttonPrimary,
  buttonSecondary,
  dangerButton,
  errorText,
  headingPage,
  successBg,
  dashboardBgColor,
  dashboardPrimaryBg,
  dashboardMutedColor,
  dashboardSurfaceColor,
  dashboardSurfaceHover,
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

function TemplateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [usingTemplate, setUsingTemplate] = useState(false)

  // Fetch by route identity. A response for a previous route must never become
  // the template that the next route's edit/delete buttons act on.
  useEffect(() => {
    let active = true
    const requestId = String(id)
    const fetchTemplate = async () => {
      try {
        setLoading(true)
        setTemplate(null)
        const res = await axios.get(
          `${API_BASE_URL}/api/templates/${id}`,
          { withCredentials: true }
        )
        if (!active || String(res.data.payload?._id) !== requestId) return
        setTemplate(res.data.payload)
      } catch (err) {
        if (!active) return
        toast.error(
          err.response?.data?.message || 'Failed to load template'
        )
        navigate('/templates')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchTemplate()
    return () => { active = false }
  }, [id, navigate])

  const routeMatches = Boolean(template && String(template._id) === String(id))
  // Server-derived capability, not an account-wide role.
  const canWrite = routeMatches && Boolean(template?.capabilities?.edit)

  //toggle favourite
  const toggleFavourite = async () => {
    if (!routeMatches) return
    const targetId = template._id
    setTemplate((prev) => ({
      ...prev,
      favourite: !prev.favourite
    }))
    try {
      await axios.patch(
        `${API_BASE_URL}/api/templates/${targetId}/favourite`,
        {},
        { withCredentials: true }
      )
    } catch {
      toast.error('Failed to update favourite')
      setTemplate((prev) => prev?._id === targetId
        ? { ...prev, favourite: !prev.favourite }
        : prev)
    }
  }

  //delete template
  const handleDelete = async () => {
    if (!routeMatches) return
    const targetId = template._id
    const confirmed = window.confirm('Delete this template?')
    if (!confirmed) return
    try {
      await axios.delete(`${API_BASE_URL}/api/templates/${targetId}`, {
        withCredentials: true
      })
      toast.success('Template deleted')
      navigate('/templates')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template')
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dashboardBgColor}`}>
        <div className={`w-8 h-8 border-2 ${dashboardPrimaryBg.replace("bg-", "border-")} border-t-transparent rounded-full animate-spin`} />
      </div>
    )
  }

  if (!template) return null

  const linear = cardLinear(template.title)

  return (
    <div className={`min-h-screen ${dashboardBgColor} text-white`}>
      {editing && (
        <TemplateEditForm
          template={template}
          onClose={() => setEditing(false)}
          onSave={(updated) => {
            setEditing(false)
            if (updated?._id) setTemplate(updated)
          }}
        />
      )}

      {usingTemplate && (
        <UseTemplateDialog
          template={template}
          onClose={() => setUsingTemplate(false)}
          onCreated={(project) => {
            setUsingTemplate(false)
            if (project?._id) navigate(`/projects/${project._id}`)
          }}
        />
      )}

      {/* header */}
      <div className="flex flex-col gap-3 border-b border-[#18181b] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/templates')}
          className={`flex items-center gap-2 ${dashboardMutedColor} hover:text-white transition-colors text-sm`}
        >
          <BsArrowLeft />
          Back to Templates
        </button>

        <div className="flex items-center gap-3">
          {/* favourite */}
          <button
            type="button"
            onClick={toggleFavourite}
            disabled={!routeMatches}
            aria-pressed={Boolean(template.favourite)}
            aria-label={
              template.favourite
                ? 'Remove from favourites'
                : 'Add to favourites'
            }
            className={`w-9 h-9 rounded-lg ${dashboardSurfaceColor} flex items-center justify-center ${dashboardSurfaceHover} transition-colors`}
          >
            {template.favourite ? (
              <BsHeartFill className={`${errorText}`} />
            ) : (
              <BsHeart className={`${dashboardMutedColor}`} />
            )}
          </button>

          {/* owner actions */}
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={buttonSecondary}
              >
                <BsPencil />
                Edit
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className={dangerButton}
              >
                <BsTrash />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* hero banner */}
      <div className="relative h-56 w-full overflow-hidden">
        {template.images?.[0] ? (
          <img
            src={template.images[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${linear}`} />
        )}

        {/* badges */}
        <div className="absolute top-4 left-4 flex gap-2">
          {template.isPublished && (
            <span className={`${successBg} text-white text-xs px-3 py-1 rounded-full font-semibold`}>
              PUBLISHED
            </span>
          )}
          <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            {template.type === 'project' ? 'PROJECT BOARD' : 'TEMPLATE'}
          </span>
        </div>
      </div>

      {/* content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={headingPage}>
              {template.title}
            </h1>
            <p className={`${dashboardMutedColor} text-sm`}>
              by {template.creatorName}
            </p>
          </div>

          <span className={`${dashboardSurfaceColor} px-3 py-1 rounded-full text-xs ${dashboardMutedColor}`}>
            {template.category}
          </span>
        </div>

        {template.description && (
          <p className={`${dashboardMutedColor} text-sm leading-relaxed mt-4`}>
            {template.description}
          </p>
        )}

        <div
          className={`mt-6 rounded-xl border ${dashboardBorderColor} ${dashboardSurfaceColor} p-4`}
        >
          <p className={`text-xs ${dashboardMutedColor} font-medium mb-2 uppercase tracking-wide`}>
            What you get
          </p>
          <p className="text-sm text-white leading-relaxed">
            A new board of your own with To Do, In Progress and Done lists.
            Tasks, comments, members and publisher details from the source are
            not copied.
          </p>
        </div>

        <button
          type="button"
          className={`${buttonPrimary} mt-6`}
          disabled={!routeMatches}
          onClick={() => setUsingTemplate(true)}
        >
          <BsBoxArrowUpRight size={14} />
          Use template
        </button>
      </div>
    </div>
  )
}

export default TemplateDetail
