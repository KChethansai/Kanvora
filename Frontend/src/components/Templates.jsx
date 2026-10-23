import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BsX, BsList, BsPlus } from 'react-icons/bs'

import axios from 'axios'
import toast from 'react-hot-toast'

import { API_BASE_URL } from '../config/api'
import { useProjectStore } from '../store/projectStore'
import Navbar from './Navbar'
import {
  dashboardBgColor,
  dashboardMutedColor,
  emptyStatePanel,
  headingPage,
  skeletonBlock
} from '../Styles/common'
import TemplateEditForm from './TemplateEditForm'
import TemplateDetailPanel from './TemplateDetailPanel'
import TemplateCard from './TemplateCard'
import { UseTemplateDialog } from '../utils/templateActions'

//includes 'Project' since all published boards fall under this category
const sideCategories = [
  'All',
  'Favorites',
  'Project',
  'Business',
  'Personal',
  'Education',
  'Engineering',
  'Marketing',
  'HR & Operations'
]

// MAIN COMPONENT

function Templates() {
  const { activeFilter } = useProjectStore()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [editTarget, setEditTarget] = useState(null)
  const [creating, setCreating] = useState(false)
  const [useTarget, setUseTarget] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 1024px)').matches
  )
  const requestRef = useRef(0)
  const deepLinkRef = useRef(null)
  const sidebarRef = useRef(null)
  const sidebarTriggerRef = useRef(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      // No media query support: the categories rail is the only usable layout.
      setIsDesktop(true)
      return
    }
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => {
      setIsDesktop(query.matches)
      if (query.matches) setSidebarOpen(false)
    }
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  const closeSidebar = () => {
    setSidebarOpen(false)
    sidebarTriggerRef.current?.focus()
  }

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return
    const first = sidebarRef.current?.querySelector('button')
    first?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSidebar()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen, isDesktop])

  // Discovery is paged on the server. The first page replaces the list; a
  // cursor page appends to it, de-duplicated by id so a row that moved between
  // pages can never be rendered twice.
  const fetchTemplates = async ({ cursor = null } = {}) => {
    // Every request owns a generation. A reset invalidates a cursor page that is
    // still in flight, so a stale append cannot advance the cursor past rows it
    // never rendered.
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const appending = Boolean(cursor)
    if (appending) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await axios.get(`${API_BASE_URL}/api/templates`, {
        params: cursor ? { cursor } : {},
        withCredentials: true
      })
      if (requestRef.current !== requestId) return
      const rows = res.data.payload || []
      setTemplates((current) => (appending
        ? [...current, ...rows.filter((row) => !current.some((existing) => existing._id === row._id))]
        : rows))
      setNextCursor(res.data.page?.nextCursor ?? null)
      setHasMore(Boolean(res.data.page?.hasMore))
    } catch {
      if (requestRef.current !== requestId) return
      if (!appending) {
        setTemplates([])
        setNextCursor(null)
        setHasMore(false)
      }
    } finally {
      if (requestRef.current === requestId) {
        if (appending) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const templateId = params.get('selected')
    if (!templateId) {
      deepLinkRef.current = null
      return
    }
    const found = templates.find((t) => t._id === templateId)
    if (found) {
      setSelectedTemplate(found)
      deepLinkRef.current = templateId
      return
    }
    // The deep link can point at a row outside the loaded page, so the row is
    // fetched directly instead of silently doing nothing.
    if (deepLinkRef.current === templateId) return
    deepLinkRef.current = templateId
    let ignore = false
    axios.get(`${API_BASE_URL}/api/templates/${templateId}`, { withCredentials: true })
      .then((res) => {
        if (!ignore && res.data?.payload) setSelectedTemplate(res.data.payload)
      })
      .catch(() => { /* an unreadable or deleted row stays closed */ })
    return () => { ignore = true }
  }, [location.search, templates])

  //toggle favourite - works for both template and project types
  const toggleFavourite = async (id) => {
    //optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t._id === id ? { ...t, favourite: !t.favourite } : t))
    )
    setSelectedTemplate((prev) =>
      prev?._id === id ? { ...prev, favourite: !prev.favourite } : prev
    )

    try {
      await axios.patch(
        `${API_BASE_URL}/api/templates/${id}/favourite`,
        {},
        { withCredentials: true }
      )
    } catch {
      //revert on failure
      toast.error('Failed to update favourite')
      setTemplates((prev) =>
        prev.map((t) => (t._id === id ? { ...t, favourite: !t.favourite } : t))
      )
      setSelectedTemplate((prev) =>
        prev?._id === id ? { ...prev, favourite: !prev.favourite } : prev
      )
    }
  }

  //delete / unpublish template
  const handleDeleteTemplate = async (id) => {
    const confirmed = window.confirm('Remove this template?')
    if (!confirmed) return
    try {
      await axios.delete(`${API_BASE_URL}/api/templates/${id}`, {
        withCredentials: true
      })
      toast.success('Template removed')
      setSelectedTemplate(null)
      //remove from local state immediately
      setTemplates((prev) => prev.filter((t) => t._id !== id))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove template')
    }
  }

  //save after create or edit, then refresh from the server
  const handleTemplateSaved = async () => {
    setEditTarget(null)
    setCreating(false)
    await fetchTemplates()
  }

  //a created board is a normal project board, not a template
  const handleBoardCreated = (project) => {
    setUseTarget(null)
    if (project?._id) navigate(`/projects/${project._id}`)
  }

  //filter by category + search
  const filtered = templates.filter((t) => {
    const templateCategory = t.category?.trim().toLowerCase()

    const selectedCategory = activeCategory?.trim().toLowerCase()

    const matchCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'favorites'
          ? t.favourite === true
          : templateCategory === selectedCategory

    const matchSearch =
      !activeFilter.search ||
      t.title?.toLowerCase().includes(activeFilter.search.toLowerCase()) ||
      t.description?.toLowerCase().includes(activeFilter.search.toLowerCase())

    return matchCategory && matchSearch
  })
  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${dashboardBgColor}`}
    >
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {(editTarget || creating) && (
          <TemplateEditForm
            template={editTarget}
            onClose={() => {
              setEditTarget(null)
              setCreating(false)
            }}
            onSave={handleTemplateSaved}
          />
        )}

        {useTarget && (
          <UseTemplateDialog
            template={useTarget}
            onClose={() => setUseTarget(null)}
            onCreated={handleBoardCreated}
          />
        )}

        {selectedTemplate && (
          <TemplateDetailPanel
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
            isOwner={Boolean(selectedTemplate.capabilities?.edit)}
            onUse={(template) => {
              setSelectedTemplate(null)
              setUseTarget(template)
            }}
            onEdit={(template) => {
              setSelectedTemplate(null)
              setEditTarget(template)
            }}
            onDelete={handleDeleteTemplate}
            onToggleFav={toggleFavourite}
          />
        )}

        <button
          type="button"
          ref={sidebarTriggerRef}
          onClick={() => setSidebarOpen(true)}
          className="premium-button-glow fixed bottom-5 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#ff4d67] text-white shadow-2xl lg:hidden"
          aria-label="Open template categories"
          aria-expanded={sidebarOpen}
          aria-controls="template-categories"
        >
          <BsList />
        </button>

        {sidebarOpen && !isDesktop && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            aria-hidden="true"
            onClick={closeSidebar}
          />
        )}

        {/* sidebar */}
        <aside
          id="template-categories"
          ref={sidebarRef}
          aria-label="Template categories"
          aria-hidden={!isDesktop && !sidebarOpen}
          inert={!isDesktop && !sidebarOpen ? '' : undefined}
          className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--kt-border)] bg-[var(--kt-surface)] p-4 backdrop-blur-xl transition-transform lg:static lg:w-56 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold text-[var(--kt-text)]">Categories</p>
            <button
              type="button"
              onClick={closeSidebar}
              className={`${dashboardMutedColor} flex h-6 w-6 items-center justify-center rounded`}
              aria-label="Close template categories"
            >
              <BsX />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {sideCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat)
                  if (!isDesktop) closeSidebar()
                }}
                aria-current={activeCategory === cat ? 'page' : undefined}
                className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#ff4d67]/14 text-[#ff8aa0]'
                    : 'text-[var(--kt-muted)] hover:bg-[var(--kt-surface-soft)] hover:text-[var(--kt-text)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 overflow-y-auto p-4 app-scrollbar sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className={headingPage}>Template marketplace</h1>
              <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
                Start a new board with To Do, In Progress and Done lists from any
                template. Source tasks and private details are not copied.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTemplate(null)
                setEditTarget(null)
                setCreating(true)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff4d67] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--kt-accent-hover)]!"
            >
              <BsPlus size={16} />
              Create template
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className={`${skeletonBlock} h-52`} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={emptyStatePanel}>
              <p className="font-semibold text-white">No templates found</p>
              <p className={`mt-1 text-sm ${dashboardMutedColor}`}>
                Try a different search or category.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((template) => (
                <TemplateCard
                  key={template._id}
                  template={template}
                  onToggleFav={toggleFavourite}
                  onClick={() => setSelectedTemplate(template)}
                  onUse={(target) => {
                    setSelectedTemplate(null)
                    setUseTarget(target)
                  }}
                />
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchTemplates({ cursor: nextCursor })}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3a424a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#22272b] disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more templates'}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Templates
