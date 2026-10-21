// Template create/edit form. Sends only fields the template API accepts and
// never exposes the retired view-only / allowPublicEdit flags.
import { useState } from 'react'
import { BsX } from 'react-icons/bs'
import axios from 'axios'
import toast from 'react-hot-toast'

import { API_BASE_URL } from '../config/api'
import useDialogFocus from '../hooks/useDialogFocus'
import {
  buildTemplatePayload,
  isProjectBacked,
  isWebUrl,
  requestErrorMessage
} from '../utils/templateActions'
import { TEMPLATE_CATEGORIES } from '../utils/projectUtils'
import {
  commonCheckbox,
  dashboardMutedColor,
  fieldBase,
  labelBase,
  modalPrimaryBtn,
  projectTextarea
} from '../Styles/common'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 10000

const emptyTemplate = {
  title: '',
  description: '',
  category: '',
  imageUrl: '',
  isPublished: false,
  companyName: '',
  website: '',
  contactEmail: '',
  templateType: '',
  notes: ''
}

function initialForm(template) {
  if (!template) return emptyTemplate
  const projectBacked = isProjectBacked(template)
  const details = template.publishDetails || {}
  return {
    title: template.title || '',
    description: template.description || '',
    category: projectBacked ? '' : template.category || '',
    imageUrl: projectBacked ? '' : template.images?.[0] || '',
    isPublished: template.isPublished ?? false,
    companyName: details.companyName || '',
    website: details.website || '',
    contactEmail: details.contactEmail || '',
    templateType: details.templateType || '',
    notes: details.notes || ''
  }
}

export default function TemplateEditForm({ template = null, onClose, onSave }) {
  const editing = Boolean(template?._id)
  const projectBacked = isProjectBacked(template)
  const dialogRef = useDialogFocus(true, onClose)

  const [form, setForm] = useState(() => initialForm(template))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const validate = () => {
    const title = form.title.trim()
    if (!title) return 'Template title is required'
    if (title.length > TITLE_MAX) {
      return `Template title must be ${TITLE_MAX} characters or fewer`
    }
    if (!projectBacked && !form.category.trim()) return 'Category is required'
    if (form.description.length > DESCRIPTION_MAX) {
      return `Description must be ${DESCRIPTION_MAX} characters or fewer`
    }
    if (form.imageUrl.trim() && !isWebUrl(form.imageUrl.trim())) {
      return 'Cover image must be a valid http(s) URL'
    }
    if (form.website.trim() && !isWebUrl(form.website.trim())) {
      return 'Website must be a valid http(s) URL'
    }
    if (
      form.contactEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
    ) {
      return 'Contact email is invalid'
    }
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    const payload = buildTemplatePayload(
      {
        title: form.title,
        description: form.description,
        category: projectBacked ? undefined : form.category,
        isPublished: form.isPublished,
        images: projectBacked
          ? undefined
          : [form.imageUrl, ...(template?.images || []).slice(1)],
        publishDetails: {
          companyName: form.companyName,
          website: form.website,
          contactEmail: form.contactEmail,
          templateType: form.templateType,
          notes: form.notes
        }
      },
      { projectBacked }
    )

    setSaving(true)
    setError('')
    try {
      const res = editing
        ? await axios.put(
            `${API_BASE_URL}/api/templates/${template._id}`,
            payload,
            { withCredentials: true }
          )
        : await axios.post(`${API_BASE_URL}/api/templates`, payload, {
            withCredentials: true
          })
      toast.success(editing ? 'Template updated' : 'Template created')
      onSave(res.data.payload)
      onClose()
    } catch (caught) {
      const message = requestErrorMessage(
        caught,
        editing ? 'Failed to update template' : 'Failed to create template'
      )
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-form-title"
        aria-busy={saving}
        tabIndex={-1}
        className="premium-card animate-enter flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl focus:outline-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2
            id="template-form-title"
            className="text-lg font-semibold text-white"
          >
            {editing ? 'Edit template' : 'Create template'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template form"
            className={`rounded-md px-2 py-1 ${dashboardMutedColor} hover:text-white`}
          >
            <BsX size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 app-scrollbar"
        >
          <div>
            <label htmlFor="template-field-title" className={labelBase}>
              Template title
            </label>
            <input
              id="template-field-title"
              name="title"
              type="text"
              value={form.title}
              maxLength={TITLE_MAX}
              onChange={handleChange}
              className={fieldBase}
              placeholder="e.g. Sprint review board"
            />
          </div>

          <div>
            <label htmlFor="template-field-description" className={labelBase}>
              Description
            </label>
            <textarea
              id="template-field-description"
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              className={projectTextarea}
              placeholder="What this template is for"
            />
          </div>

          {projectBacked ? (
            <p className={`text-xs ${dashboardMutedColor}`}>
              This template is backed by a published project. Its category and
              cover image are managed from the project, so they are not editable
              here.
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="template-field-category" className={labelBase}>
                  Category
                </label>
                <select
                  id="template-field-category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className={fieldBase}
                >
                  <option value="">Select category</option>
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="template-field-image" className={labelBase}>
                  Cover image URL (optional)
                </label>
                <input
                  id="template-field-image"
                  name="imageUrl"
                  type="url"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className={fieldBase}
                  placeholder="https://example.com/cover.png"
                />
              </div>
            </>
          )}

          <div>
            <label className="flex items-center gap-3 text-sm text-white">
              <input
                type="checkbox"
                name="isPublished"
                checked={form.isPublished}
                onChange={handleChange}
                className={commonCheckbox}
              />
              Published in the marketplace
            </label>
            <p className={`mt-1 text-xs ${dashboardMutedColor}`}>
              People who can see a published template can create their own
              independent copy. Your board data stays private.
            </p>
          </div>

          <fieldset className="border-t border-white/[0.07] pt-3">
            <legend className={`mb-2 text-xs font-bold uppercase tracking-wide ${dashboardMutedColor}`}>
              Publisher details (optional, private)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="template-field-company" className={labelBase}>
                  Company
                </label>
                <input
                  id="template-field-company"
                  name="companyName"
                  type="text"
                  value={form.companyName}
                  onChange={handleChange}
                  className={fieldBase}
                />
              </div>
              <div>
                <label htmlFor="template-field-website" className={labelBase}>
                  Website
                </label>
                <input
                  id="template-field-website"
                  name="website"
                  type="text"
                  value={form.website}
                  onChange={handleChange}
                  className={fieldBase}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label htmlFor="template-field-email" className={labelBase}>
                  Contact email
                </label>
                <input
                  id="template-field-email"
                  name="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={handleChange}
                  className={fieldBase}
                />
              </div>
              <div>
                <label htmlFor="template-field-type" className={labelBase}>
                  Template type
                </label>
                <input
                  id="template-field-type"
                  name="templateType"
                  type="text"
                  value={form.templateType}
                  onChange={handleChange}
                  className={fieldBase}
                  placeholder="e.g. Kanban"
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-[#ff8aa0]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`rounded px-4 py-2 text-sm ${dashboardMutedColor} hover:text-white`}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={modalPrimaryBtn}>
              {saving
                ? 'Saving…'
                : editing
                  ? 'Save template'
                  : 'Create template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
