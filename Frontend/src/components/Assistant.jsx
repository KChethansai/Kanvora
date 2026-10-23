// Kanvora Assistant: a read-only product-help panel.
//
// Without a Gemini key the panel answers from the verified help content and
// says so. With a key it asks the backend, which owns the provider call and the
// project authorization. The panel never sends a secret, never renders HTML from
// a reply, and keeps only a bounded in-memory conversation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  BsArrowRight,
  BsChatDots,
  BsSend,
  BsStars,
  BsTrash,
  BsX
} from 'react-icons/bs'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import useDialogFocus from '../hooks/useDialogFocus'
import {
  answerQuestion,
  ASSISTANT_ROUTES,
  helpModeNotice,
  suggestedQuestions
} from '../utils/assistantHelp'
import {
  dashboardBorderColor,
  dashboardMutedColor,
  dashboardPanelElevated,
  dashboardPrimaryBg,
  dashboardPrimaryText,
  dashboardSurfaceColor,
  dashboardTextColor
} from '../Styles/common'

const MAX_MESSAGE = 1000
const MAX_EXCHANGES = 20
const MAX_HISTORY_TURNS = 10

// 20 exchanges = 40 messages. The oldest exchange is dropped, so the panel and
// the request payload stay bounded for the whole session.
const boundMessages = (messages) => messages.slice(-(MAX_EXCHANGES * 2))

// The server bounds a user turn at 1000 characters, an assistant turn at 4000
// and the whole conversation at 8000. A long answer must stay replayable, so
// each turn is shortened for the transcript and the oldest turns are dropped
// until the next request fits the budget.
const HISTORY_TURN_CHARS = 900
const HISTORY_BUDGET = 7000

const historyFor = (messages) => {
  const turns = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-(MAX_HISTORY_TURNS + 1), -1)
    .map((message) => ({
      role: message.role,
      content: message.content.length > HISTORY_TURN_CHARS
        ? `${message.content.slice(0, HISTORY_TURN_CHARS)}…`
        : message.content
    }))
  const kept = []
  let total = 0
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (total + turn.content.length > HISTORY_BUDGET) break
    kept.unshift(turn)
    total += turn.content.length
  }
  return kept
}

let nextId = 0
const messageId = () => {
  nextId += 1
  return `assistant-message-${nextId}`
}

function Assistant() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const projects = useProjectStore((state) => state.projects)
  const accountKey = currentUser?._id || null

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState({ enabled: false, mode: 'help', model: null, notice: helpModeNotice })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [includeContext, setIncludeContext] = useState(false)
  const [projectId, setProjectId] = useState('')

  const launcherRef = useRef(null)
  const logRef = useRef(null)
  const inFlightRef = useRef(false)
  const inputRef = useRef(null)
  // Every conversation has a generation. Clearing, or switching accounts,
  // retires it so an answer that arrives later cannot repopulate the panel.
  const generationRef = useRef(0)
  const close = useCallback(() => setOpen(false), [])
  const panelRef = useDialogFocus(open, close)

  // A conversation belongs to one account. Switching accounts starts clean.
  useEffect(() => {
    generationRef.current += 1
    setMessages([])
    setInput('')
    setError(null)
    setIncludeContext(false)
    setProjectId('')
  }, [accountKey])

  useEffect(() => {
    let ignore = false
    axios.get(`${API_BASE_URL}/api/assistant/status`, { withCredentials: true })
      .then((response) => {
        if (ignore) return
        const payload = response?.data?.payload
        if (payload && typeof payload.enabled === 'boolean') {
          setStatus({
            enabled: payload.enabled,
            mode: payload.enabled ? 'ai' : 'help',
            model: payload.model || null,
            notice: payload.notice || null
          })
        }
      })
      .catch(() => { /* status is optional: the panel stays in help mode */ })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!open) return
    // Keep the newest message in view without trapping the panel scroll.
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight })
  }, [open, messages])

  const lastReply = [...messages].reverse().find((message) => message.role === 'assistant')

  const go = (route) => {
    if (!ASSISTANT_ROUTES.includes(route)) return
    close()
    navigate(route)
  }

  const send = async (text) => {
    const message = String(text ?? input).trim()
    if (!message || sending) return
    if (message.length > MAX_MESSAGE) {
      setError(`Messages are limited to ${MAX_MESSAGE} characters.`)
      return
    }
    // A guard outside React state: two clicks in the same tick must not send
    // two provider requests.
    if (inFlightRef.current) return
    inFlightRef.current = true
    const generation = generationRef.current
    setSending(true)
    setError(null)
    setInput('')

    const outgoing = boundMessages([...messages, { id: messageId(), role: 'user', content: message }])
    setMessages(outgoing)
    // Sending a suggestion removes the button that had focus. The composer is
    // the stable place to continue, and the reply is announced by the live
    // region, so focus never falls out of the dialog.
    inputRef.current?.focus()

    if (!status.enabled) {
      const answer = answerQuestion(message)
      setMessages(boundMessages([...outgoing, {
        id: messageId(), role: 'assistant', content: answer.reply, routes: answer.routes, mode: 'help'
      }]))
      inFlightRef.current = false
      setSending(false)
      return
    }

    try {
      const body = { message, history: historyFor(outgoing) }
      if (includeContext && projectId) {
        body.projectId = projectId
        body.includeProjectContext = true
      }
      const response = await axios.post(`${API_BASE_URL}/api/assistant/chat`, body, { withCredentials: true })
      const payload = response?.data?.payload
      const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''
      if (!reply) throw new Error('empty reply')
      // The conversation was cleared (or the account changed) while the answer
      // was in flight: discard it instead of resurrecting the old question.
      if (generation !== generationRef.current) return
      setMessages(boundMessages([...outgoing, {
        id: messageId(),
        role: 'assistant',
        content: reply,
        routes: Array.isArray(payload.routes) ? payload.routes : [],
        mode: 'ai',
        context: payload.projectContext || null
      }]))
    } catch (requestError) {
      if (generation !== generationRef.current) return
      // Never present a failed AI call as an AI answer. The built-in help is
      // offered instead, clearly marked.
      const answer = answerQuestion(message)
      setMessages(boundMessages([...outgoing, {
        id: messageId(), role: 'assistant', content: answer.reply, routes: answer.routes, mode: 'help', failed: true
      }]))
      setError(requestError?.response?.data?.message || 'The assistant could not answer. Showing built-in help instead.')
    } finally {
      inFlightRef.current = false
      setSending(false)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  const clearConversation = () => {
    generationRef.current += 1
    setMessages([])
    setError(null)
  }

  const contextProjects = useMemo(
    () => (Array.isArray(projects) ? projects.filter((project) => project?._id) : []),
    [projects]
  )

  return (
    <>
      {/* The launcher stays mounted so closing the panel can restore focus to
          it. While the panel is open it is visually hidden and out of the tab
          order, and the panel's own close control is the visible action. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Kanvora Assistant"
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={`fixed bottom-20 right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full lg:bottom-6 lg:right-6 ${dashboardPrimaryBg} text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${
          open ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        <BsChatDots className="text-xl" aria-hidden="true" />
      </button>

      {open && (
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kanvora-assistant-title"
      tabIndex={-1}
      className={`fixed inset-x-2 bottom-2 top-16 z-[60] flex flex-col overflow-hidden rounded-2xl border ${dashboardBorderColor} ${dashboardSurfaceColor} shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[520px] sm:w-96`}
    >
      <header className={`flex items-center justify-between gap-2 border-b ${dashboardBorderColor} px-4 py-3`}>
        <div className="min-w-0">
          <h2 id="kanvora-assistant-title" className={`truncate text-sm font-semibold ${dashboardTextColor}`}>
            Kanvora Assistant
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[#8c9bab]">
            {status.enabled ? <BsStars aria-hidden="true" /> : null}
            {status.enabled ? `AI · ${status.model || 'configured'}` : 'Help mode'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={clearConversation}
            disabled={messages.length === 0}
            aria-label="Clear conversation"
            className="rounded p-1.5 text-[#8c9bab] transition-colors hover:bg-[#22272b] hover:text-white disabled:opacity-40"
          >
            <BsTrash className="text-sm" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close assistant"
            className="rounded p-1.5 text-[#8c9bab] transition-colors hover:bg-[#22272b] hover:text-white"
          >
            <BsX className="text-lg" aria-hidden="true" />
          </button>
        </div>
      </header>

      {!status.enabled && (
        <p className={`border-b ${dashboardBorderColor} bg-[#ff4d67]/5 px-4 py-2 text-[10px] leading-snug ${dashboardMutedColor}`}>
          {status.notice || helpModeNotice}
        </p>
      )}

      <div ref={logRef} data-testid="assistant-log" className="flex-1 space-y-3 overflow-y-auto px-4 py-3 app-scrollbar">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className={`text-xs ${dashboardMutedColor}`}>
              Ask about a Kanvora workflow, or pick one of these:
            </p>
            <div className="flex flex-col gap-1.5">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className={`flex items-center justify-between gap-2 rounded-lg border ${dashboardBorderColor} px-3 py-2 text-left text-[11px] ${dashboardTextColor} transition-colors hover:bg-[#22272b]`}
                >
                  <span>{question}</span>
                  <BsArrowRight className="shrink-0 text-[#8c9bab]" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? `${dashboardPrimaryBg} ${dashboardPrimaryText}`
                    : `${dashboardPanelElevated} ${dashboardTextColor}`
                }`}
              >
                {message.content}
                {message.role === 'assistant' && message.context?.included && (
                  <p className="mt-2 text-[10px] text-[#8c9bab]">
                    Context: {message.context.projectName || 'selected project'}
                    {message.context.truncated ? ' (partial snapshot)' : ''}
                  </p>
                )}
                {message.role === 'assistant' && Array.isArray(message.routes) && message.routes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.routes
                      .map((route) => (typeof route === 'string' ? { label: route, to: route } : route))
                      .filter((route) => route && ASSISTANT_ROUTES.includes(route.to))
                      .map((route) => (
                        <button
                          key={route.to}
                          type="button"
                          onClick={() => go(route.to)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#b6c2cf] hover:bg-[#22272b]"
                        >
                          {route.label || route.to}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <p className={`text-[11px] ${dashboardMutedColor}`} role="status">Assistant is typing…</p>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-[#ff4d67]/30 bg-[#ff4d67]/10 px-4 py-2 text-[10px] leading-snug text-[#ff8aa0]">
          {error}
        </p>
      )}

      {status.enabled && (
        <div className={`border-t ${dashboardBorderColor} px-4 py-2`}>
          <label className="flex items-center gap-2 text-[10px] text-[#b6c2cf]">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(event) => setIncludeContext(event.target.checked)}
              disabled={!projectId}
              className="app-native-checkbox h-3 w-3 accent-[#ff4d67]"
            />
            Include read-only context from a project
          </label>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            aria-label="Project to share with the assistant"
            className={`app-native-select mt-1 w-full rounded-md border ${dashboardBorderColor} bg-[#101418] px-2 py-1 text-[11px] text-white`}
          >
            <option value="">Select a project</option>
            {contextProjects.map((project) => (
              <option key={project._id} value={project._id}>{project.title || project.name || 'Untitled'}</option>
            ))}
          </select>
          {includeContext && projectId && (
            <p className="mt-1 text-[10px] text-[#8c9bab]">
              The project title, lists and up to 50 cards are sent to Google Gemini for this answer. Comments and attachments are never included.
            </p>
          )}
        </div>
      )}

      <div className={`border-t ${dashboardBorderColor} px-3 py-2`}>
        <div className="flex items-end gap-2">
          <label htmlFor="kanvora-assistant-input" className="sr-only">Message the Kanvora Assistant</label>
          <textarea
            id="kanvora-assistant-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE}
            data-autofocus
            placeholder="Ask about Kanvora…"
            className={`max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border ${dashboardBorderColor} bg-[#101418] px-3 py-2 text-xs text-white placeholder:text-[#6b7a89] focus:outline-none focus:ring-2 focus:ring-[#ff4d67]/40`}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${dashboardPrimaryBg} text-white transition-colors disabled:opacity-50`}
          >
            <BsSend className="text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {lastReply ? `Assistant: ${lastReply.content}` : ''}
      </div>
    </section>
      )}
    </>
  )
}

export default Assistant
