// Projects component: renders a focused piece of the Kanvora UI.
import { useState, useEffect } from 'react'
import {
  BsClockHistory,
  BsPlusLg,
  BsX,
  BsTrash,
  BsImage
} from 'react-icons/bs'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useDialogFocus from '../hooks/useDialogFocus'
import { useProjectStore } from '../store/projectStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  errorBgHover,
  errorText,
  dashboardMutedColor,
  dashboardBgColor,
  dashboardBorderColor,
  dashboardTextColor,
  dashboardPrimaryBg,
  dashboardPrimaryBgHover,
  dashboardPrimaryText,
  fieldText
} from '../Styles/common'

const bgOptions = [
  { value: 'from-blue-500 to-blue-700', label: 'Ocean' },
  { value: 'from-orange-400 to-orange-600', label: 'Sunset' },
  { value: 'from-violet-500 to-purple-700', label: 'Amethyst' },
  { value: 'from-emerald-400 to-teal-600', label: 'Forest' },
  { value: 'from-rose-400 to-pink-600', label: 'Rose' },
  { value: 'from-slate-500 to-slate-700', label: 'Slate' }
]

// Project Card

function ProjectCard({ project, onClick, onDelete }) {
  const name = project.title || project.name
  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.07] shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-[#ff4d67]/40 hover:shadow-[0_18px_50px_rgba(255,77,103,0.18)]"
      style={{ height: '96px' }}
    >
      {project.img ? (
        <img
          src={project.img}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full bg-linear-to-br ${project.color || 'from-blue-500 to-blue-700'}`}
        />
      )}

      <div
        className="absolute inset-0 bg-black opacity-0 transition-opacity duration-150 group-hover:opacity-20 group-focus-within:opacity-20"
        aria-hidden="true"
      />

      {/* The cover is a saturated gradient, so the title needs a scrim of its
          own to stay readable in both themes. */}
      <div
        className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/55 to-transparent"
        aria-hidden="true"
      />

      <span className="on-scrim absolute bottom-2 left-2 text-sm font-semibold drop-shadow">
        {name}
      </span>

      <button
        type="button"
        onClick={onClick}
        aria-label={`Open project ${name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-offset-[-4px]"
      />

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(project._id)
          }}
          className={`on-scrim absolute top-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded bg-black/60 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${errorBgHover}`}
          aria-label={`Delete project ${name}`}
        >
          <BsTrash className="text-[10px]" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// Create Project Modal

export function CreateProjectModal({ onClose, onCreate, workspaces = [], defaultWorkspaceId }) {
  const [title, setTitle] = useState('')
  const [selectedBg, setSelectedBg] = useState(bgOptions[0])
  const [backgroundFile, setBackgroundFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(defaultWorkspaceId || workspaces[0]?._id || '')
  const dialogRef = useDialogFocus(true, onClose)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Project title is required')
      return
    }
    if (!selectedWorkspaceId) {
      toast.error('Please select a workspace')
      return
    }
    setSubmitting(true)
    await onCreate({
      title: title.trim(),
      color: selectedBg.value,
      backgroundFile,
      workspaceId: selectedWorkspaceId,
      isEditable: true,
      isPublished: false
    })
    setSubmitting(false)
    onClose()
  }

  const handleBackgroundChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG images are allowed')
      return
    }
    setBackgroundFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <div
      className="fixed inset-0 bg-black/65 z-50 flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-6 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-heading"
        tabIndex={-1}
        className="premium-card animate-enter rounded-2xl w-full max-w-sm p-5 my-auto max-h-[calc(100dvh-3rem)] overflow-y-auto app-scrollbar"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="create-project-heading" className="text-sm font-semibold text-white">Create project</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create project dialog"
            className={`${dashboardMutedColor} hover:text-white`}
          >
            <BsX className="text-lg" aria-hidden="true" />
          </button>
        </div>

        {/* preview */}
        <div
          className={`h-24 rounded-lg bg-linear-to-br ${selectedBg.value} mb-4 flex items-center justify-center overflow-hidden`}
          aria-hidden="true"
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
          {!previewUrl && (
            <span className="on-scrim font-semibold text-sm opacity-80">
              {title || 'Project title'}
            </span>
          )}
        </div>

        {/* background picker */}
        <p className={`text-xs ${dashboardMutedColor} mb-2 font-semibold`}>
          Background
        </p>
        <div className="flex gap-2 flex-wrap mb-4">
          {bgOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSelectedBg(opt)
                setBackgroundFile(null)
                setPreviewUrl('')
              }}
              aria-label={`Background ${opt.label}`}
              aria-pressed={selectedBg.value === opt.value}
              className={`w-10 h-7 rounded bg-linear-to-br ${opt.value} ${
                selectedBg.value === opt.value ? 'ring-2 ring-[var(--kt-accent)]' : ''
              }`}
            />
          ))}
        </div>

        <label
          className={`flex items-center justify-center gap-2 w-full h-9 rounded ${dashboardBgColor} border ${dashboardBorderColor} ${dashboardTextColor} text-xs font-semibold hover:bg-[#18181b] cursor-pointer mb-4 focus-within:ring-2 focus-within:ring-[var(--kt-accent)]`}
        >
          <BsImage aria-hidden="true" /> Upload JPG/PNG background
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={handleBackgroundChange}
          />
        </label>

        <label
          htmlFor="create-project-title"
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Project title <span className={`${errorText}`}>*</span>
        </label>
        <input
          id="create-project-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Enter project title..."
          data-autofocus
          className={`w-full ${dashboardBgColor} border border-[var(--kt-field-border)] rounded px-3 py-2 text-sm ${fieldText} focus:outline-none focus:border-[#ff4d67] mb-4`}
        />

        <label
          htmlFor="create-project-workspace"
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Workspace <span className={`${errorText}`}>*</span>
        </label>
        <select
          id="create-project-workspace"
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className={`w-full ${dashboardBgColor} border border-[var(--kt-field-border)] rounded px-3 py-2 text-sm ${fieldText} focus:outline-none focus:border-[#ff4d67] mb-4`}
        >
          {workspaces.map((ws) => (
            <option key={ws._id} value={ws._id}>
              {ws.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting || !title.trim() || !selectedWorkspaceId}
          className={`w-full ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 disabled:cursor-not-allowed ${dashboardPrimaryText} text-sm font-semibold py-2 rounded transition-colors`}
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

function CreateProjectCard({ onClick }) {
  return (
    <button
      type="button"
      className="premium-card-hover flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-[#111111]/80 transition-colors hover:border-[#ff4d67]/45"
      style={{ height: '96px' }}
      onClick={onClick}
    >
      <span
        className="on-scrim text-sm transition-opacity hover:opacity-80"
      >
        Create new project
      </span>
    </button>
  )
}

export function CreateWorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useDialogFocus(true, onClose)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Workspace name is required')
      return
    }
    setSubmitting(true)
    await onCreate(name.trim())
    setSubmitting(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/65 z-50 flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-6 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-heading"
        tabIndex={-1}
        className="premium-card animate-enter rounded-2xl w-full max-w-sm p-5 my-auto max-h-[calc(100dvh-3rem)] overflow-y-auto app-scrollbar"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="create-workspace-heading" className="text-sm font-semibold text-white">Create workspace</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create workspace dialog"
            className={`${dashboardMutedColor} hover:text-white`}
          >
            <BsX className="text-lg" aria-hidden="true" />
          </button>
        </div>
        <label
          htmlFor="create-workspace-name"
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Workspace name
        </label>
        <input
          id="create-workspace-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Product team"
          data-autofocus
          className={`w-full ${dashboardBgColor} border border-[var(--kt-field-border)] rounded px-3 py-2 text-sm ${fieldText} focus:outline-none focus:border-[#ff4d67] mb-4`}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting || !name.trim()}
          className={`w-full ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 disabled:cursor-not-allowed ${dashboardPrimaryText} text-sm font-semibold py-2 rounded transition-colors`}
        >
          {submitting ? 'Creating...' : 'Create workspace'}
        </button>
      </div>
    </div>
  )
}

// Projects Main

function Projects() {
  const navigate = useNavigate()
  const {
    projects,
    recentProjects,
    loading,
    fetchProjects,
    fetchRecentProjects,
    createProject,
    deleteProject,
    activeFilter
  } = useProjectStore()

  const filteredProjects = projects.filter((project) => {
    const title = (project.title || project.name || '').toLowerCase()
    const matchesSearch = title.includes((activeFilter?.search || '').toLowerCase())
    return matchesSearch && !project.archivedAt
  })
  const filteredRecentProjects = recentProjects.filter((project) => {
    const title = (project.title || project.name || '').toLowerCase()
    return title.includes((activeFilter?.search || '').toLowerCase())
  })
  const {
    workspaces,
    activeWorkspace,
    loading: workspaceLoading,
    fetchWorkspaces,
    createWorkspace
  } = useWorkspaceStore()
  const [showModal, setShowModal] = useState(false)
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)

  useEffect(() => {
    fetchWorkspaces()
    fetchRecentProjects()
    fetchProjects()
  }, [fetchWorkspaces, fetchRecentProjects, fetchProjects])

  const handleCreateProject = async (data) => {
    const newProject = await createProject(data)
    if (newProject) toast.success('Project created!')
  }

  const handleCreateWorkspace = async (name) => {
    try {
      await createWorkspace({ name })
      toast.success('Workspace created!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create workspace')
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (!confirm('Delete this project and all its lists and cards?')) return
    const deleted = await deleteProject(projectId)
    if (deleted) toast.success('Project deleted')
    else toast.error('Could not delete project')
  }

  if (loading || workspaceLoading) {
    return (
      <div
        className={`flex-1 flex items-center justify-center ${dashboardBgColor}`}
      >
        <div
          className={`w-6 h-6 border-2 ${dashboardPrimaryBg.replace('bg-', 'border-')} border-t-transparent rounded-full animate-spin`}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex-1 overflow-y-auto premium-app-bg ${dashboardTextColor} px-4 py-5 app-scrollbar sm:px-6 lg:px-8`}
    >
      {/* recently viewed */}
      {filteredRecentProjects.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <BsClockHistory className={`text-base ${dashboardMutedColor}`} />
            <h2 className={`text-sm font-semibold ${dashboardTextColor}`}>
              Recently viewed
            </h2>
          </div>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(194px, 1fr))'
            }}
          >
            {filteredRecentProjects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                onClick={() => navigate(`/projects/${p._id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* your workspaces */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] flex items-center justify-center text-[var(--kt-on-accent)] text-xs font-bold">
              P
            </span>
            <h2 className="text-sm font-semibold text-white">
              All projects
            </h2>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed ${dashboardBorderColor} bg-[#111111]/70 px-6 py-10 text-center backdrop-blur-xl`}
          >
            <h3 className="text-white font-semibold mb-2">
              Create your first workspace
            </h3>
            <p className={`text-sm ${dashboardMutedColor} mb-5`}>
              Workspaces keep each team or project area organized with its own
              projects.
            </p>
            <button
              type="button"
              onClick={() => setShowWorkspaceModal(true)}
              className={`inline-flex items-center gap-2 px-4 h-9 rounded ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} ${dashboardPrimaryText} text-sm font-semibold transition-colors`}
            >
              <BsPlusLg className="text-xs" /> Create workspace
            </button>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(194px, 1fr))'
            }}
          >
            {filteredProjects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                onClick={() => navigate(`/projects/${p._id}`)}
                onDelete={
                  p.capabilities?.manage ? handleDeleteProject : undefined
                }
              />
            ))}
            <CreateProjectCard onClick={() => setShowModal(true)} />
          </div>
        )}

        {workspaces.length > 0 && projects.length === 0 && !loading && (
          <p className={`text-sm ${dashboardMutedColor} mt-4 text-center`}>
            No projects yet - create your first one!
          </p>
        )}
      </section>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateProject}
          workspaces={workspaces}
          defaultWorkspaceId={activeWorkspace?._id}
        />
      )}
      {showWorkspaceModal && (
        <CreateWorkspaceModal
          onClose={() => setShowWorkspaceModal(false)}
          onCreate={handleCreateWorkspace}
        />
      )}
    </div>
  )
}

export default Projects
