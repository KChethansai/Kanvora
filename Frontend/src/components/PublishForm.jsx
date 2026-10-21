import { useState } from 'react'
import axios from 'axios'
import { BsX } from 'react-icons/bs'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'
import useDialogFocus from '../hooks/useDialogFocus'
import { requestErrorMessage } from '../utils/templateActions'
import {
  projectInput,
  projectTextarea,
  modalPrimaryBtn,
  dashboardMutedColor,
  dashboardBorderColor,
  dashboardTextColor,
  dashboardSurfaceColor,
  dashboardSurfaceHover
} from '../Styles/common'
import { TEMPLATE_CATEGORIES } from '../utils/projectUtils'

export default function PublishForm({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    title: project.title || '',
    description: project.description || '',
    category: project.publishDetails?.category || '',
    companyName: project.publishDetails?.companyName || '',
    website: project.publishDetails?.website || '',
    contactEmail: project.publishDetails?.contactEmail || '',
    templateType: project.publishDetails?.templateType || '',
    notes: project.publishDetails?.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(true, onClose)

  const errors = {
    title: submitted && !form.title.trim() ? 'Project title is required' : '',
    category: submitted && !form.category.trim() ? 'Category is required' : ''
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async () => {
    setSubmitted(true)
    if (!form.title.trim() || !form.category.trim()) return
    setSaving(true)
    setError('')
    try {
      const { title, description, category, ...publishDetails } = form
      const res = await axios.put(
        `${API_BASE_URL}/projects-api/projects/${project._id}`,
        {
          title: title.trim(),
          description,
          isPublished: true,
          publishDetails: {
            ...publishDetails,
            category: category.trim()
          }
        },
        { withCredentials: true }
      )
      toast.success('Project published to the template marketplace')
      onSave(res.data.payload)
      onClose()
    } catch (caught) {
      const message = requestErrorMessage(caught, 'Failed to publish project')
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-form-title"
        aria-busy={saving}
        tabIndex={-1}
        className="premium-card animate-enter flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl mx-4 focus:outline-none"
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b ${dashboardBorderColor} px-6 py-4`}
        >
          <h3
            id="publish-form-title"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <span className={`text-xl ${dashboardMutedColor}`}>◆</span> Publish
            Project
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close publish form"
            className={`flex h-8 w-8 items-center justify-center rounded-md ${dashboardMutedColor} ${dashboardSurfaceColor} hover:text-white transition-colors`}
          >
            <BsX />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 app-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label
                htmlFor="publish-field-title"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Project Title
              </label>
              <input
                id="publish-field-title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                className={projectInput}
                placeholder="Enter project title"
                aria-describedby={errors.title ? 'publish-title-error' : undefined}
              />
              {errors.title && (
                <p id="publish-title-error" role="alert" className="mt-1 text-xs text-red-300">
                  {errors.title}
                </p>
              )}
            </div>
            <div className="col-span-1">
              <label
                htmlFor="publish-field-category"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Category
              </label>
              <select
                id="publish-field-category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className={`app-native-select ${projectInput}`}
                aria-describedby={errors.category ? 'publish-category-error' : undefined}
              >
                <option value="">Select category</option>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p id="publish-category-error" role="alert" className="mt-1 text-xs text-red-300">
                  {errors.category}
                </p>
              )}
            </div>
            <div className="col-span-1">
              <label
                htmlFor="publish-field-template-type"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Template Type
              </label>
              <input
                id="publish-field-template-type"
                name="templateType"
                type="text"
                value={form.templateType}
                onChange={handleChange}
                className={projectInput}
                placeholder="e.g. Kanban, Calendar"
              />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="publish-field-description"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Description
              </label>
              <textarea
                id="publish-field-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={2}
                className={projectTextarea}
                placeholder="Describe your project..."
              />
            </div>
            <div className={`col-span-2 rounded-lg border ${dashboardBorderColor} bg-[#0a0a0a] p-3`}>
              <p className={`text-xs ${dashboardMutedColor} leading-relaxed`}>
                Publishing lists this board in the template marketplace. People
                who can see it create their own independent copy with To Do, In
                Progress and Done lists. Your tasks, comments, members and
                publisher contact details are not copied.
              </p>
            </div>
            <div
              className={`col-span-2 border-t ${dashboardBorderColor} pt-2 pb-1`}
            >
              <h4
                className={`text-xs font-bold uppercase tracking-widest ${dashboardTextColor}`}
              >
                Publisher Details
              </h4>
              <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
                Company, website and template type appear with the listing.
                Contact email and notes stay private.
              </p>
            </div>
            <div className="col-span-1">
              <label
                htmlFor="publish-field-company"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Company Name
              </label>
              <input
                id="publish-field-company"
                name="companyName"
                type="text"
                value={form.companyName}
                onChange={handleChange}
                className={projectInput}
                placeholder="Your organization"
              />
            </div>
            <div className="col-span-1">
              <label
                htmlFor="publish-field-website"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Website
              </label>
              <input
                id="publish-field-website"
                name="website"
                type="text"
                value={form.website}
                onChange={handleChange}
                className={projectInput}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div className="col-span-1">
              <label
                htmlFor="publish-field-email"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Contact Email
              </label>
              <input
                id="publish-field-email"
                name="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={handleChange}
                className={projectInput}
                placeholder="contact@company.com"
              />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="publish-field-notes"
                className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${dashboardMutedColor}`}
              >
                Notes
              </label>
              <textarea
                id="publish-field-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                className={projectTextarea}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        <div
          className={`flex shrink-0 flex-col gap-3 border-t ${dashboardBorderColor} px-6 py-4 sm:flex-row sm:items-center sm:justify-end`}
        >
          {error && (
            <p role="alert" className="text-sm text-red-300 sm:mr-auto">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`rounded px-4 py-2 text-sm ${dashboardMutedColor} ${dashboardSurfaceHover} hover:text-white transition-colors`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={`${modalPrimaryBtn} flex items-center gap-2`}
          >
            {saving && (
              <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white" />
            )}
            Publish
          </button>
        </div>
      </div>
    </div>
  )
}
