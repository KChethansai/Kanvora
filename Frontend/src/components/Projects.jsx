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
  dashboardPrimaryText
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
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.07] shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-[#ff4d67]/40 hover:shadow-[0_18px_50px_rgba(255,77,103,0.18)]"
      style={{ height: '96px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {project.img ? (
        <img
          src={project.img}
          alt={project.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full bg-linear-to-br ${project.color || 'from-blue-500 to-blue-700'}`}
        />
      )}

      <div
        className={`absolute inset-0 bg-black transition-opacity duration-150 ${
          hovered ? 'opacity-20' : 'opacity-0'
        }`}
      />

      <span className="absolute bottom-2 left-2 text-white text-sm font-semibold drop-shadow">
        {project.title || project.name}
      </span>

      {onDelete && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(project._id)
          }}
          className={`absolute top-1.5 right-1.5 w-6 h-6 bg-black/40 rounded flex items-center justify-center text-white ${errorBgHover} transition-colors`}
        >
          <BsTrash className="text-[10px]" />
        </button>
      )}
    </div>
  )
}

// Create Project Modal

function CreateProjectModal({ onClose, onCreate, workspaces = [], defaultWorkspaceId }) {
  const [title, setTitle] = useState('')
  const [selectedBg, setSelectedBg] = useState(bgOptions[0])
  const [backgroundFile, setBackgroundFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(defaultWorkspaceId || workspaces[0]?._id || '')

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
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="premium-card animate-enter rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Create project</h3>
          <button
            onClick={onClose}
            className={`${dashboardMutedColor} hover:text-white`}
          >
            <BsX className="text-lg" />
          </button>
        </div>

        {/* preview */}
        <div
          className={`h-24 rounded-lg bg-linear-to-br ${selectedBg.value} mb-4 flex items-center justify-center overflow-hidden`}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Project background preview"
              className="w-full h-full object-cover"
            />
          )}
          {!previewUrl && (
            <span className="text-white font-semibold text-sm opacity-80">
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
              onClick={() => {
                setSelectedBg(opt)
                setBackgroundFile(null)
                setPreviewUrl('')
              }}
              className={`w-10 h-7 rounded bg-linear-to-br ${opt.value} ${
                selectedBg.value === opt.value ? 'ring-2 ring-white' : ''
              }`}
            />
          ))}
        </div>

        <label
          className={`flex items-center justify-center gap-2 w-full h-9 rounded ${dashboardBgColor} border ${dashboardBorderColor} ${dashboardTextColor} text-xs font-semibold hover:bg-[#18181b] cursor-pointer mb-4`}
        >
          <BsImage /> Upload JPG/PNG background
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleBackgroundChange}
          />
        </label>

        <label
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Project title <span className={`${errorText}`}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Enter project title..."
          className={`w-full ${dashboardBgColor} border ${dashboardBorderColor} rounded px-3 py-2 text-sm text-white ${dashboardMutedColor} focus:outline-none focus:border-[#ff4d67] mb-4`}
          autoFocus
        />

        <label
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Workspace <span className={`${errorText}`}>*</span>
        </label>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className={`w-full ${dashboardBgColor} border ${dashboardBorderColor} rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4d67] mb-4`}
        >
          {workspaces.map((ws) => (
            <option key={ws._id} value={ws._id}>
              {ws.name}
            </option>
          ))}
        </select>

        <button
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
    <div
      className="premium-card-hover flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-[#111111]/80 transition-colors hover:border-[#ff4d67]/45"
      style={{ height: '96px' }}
      onClick={onClick}
    >
      <span
        className={`${dashboardMutedColor} text-sm hover:text-white transition-colors`}
      >
        Create new project
      </span>
    </div>
  )
}

function CreateWorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="premium-card animate-enter rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Create workspace</h3>
          <button
            onClick={onClose}
            className={`${dashboardMutedColor} hover:text-white`}
          >
            <BsX className="text-lg" />
          </button>
        </div>
        <label
          className={`text-xs ${dashboardMutedColor} font-semibold block mb-1`}
        >
          Workspace name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Product team"
          className={`w-full ${dashboardBgColor} border ${dashboardBorderColor} rounded px-3 py-2 text-sm text-white ${dashboardMutedColor} focus:outline-none focus:border-[#ff4d67] mb-4`}
          autoFocus
        />
        <button
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
    await deleteProject(projectId)
    toast.success('Project deleted')
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
            <span className="w-7 h-7 rounded bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)] flex items-center justify-center text-white text-xs font-bold">
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
                onDelete={handleDeleteProject}
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
