// Frontend/src/components/ui/command.jsx
//
// The command palette listbox.
//
// This is a house primitive rather than a library component on purpose. The
// copy-in "command" component from shadcn/ui brings cmdk, and cmdk brings
// sixteen Radix packages, including a dialog. Measured on this application,
// that added about 22 kB gzipped to the entry chunk - a 24% growth of the
// JavaScript every route loads - and a second dialog implementation next to
// the focus manager the application already owns.
//
// The behaviour that matters is small and is implemented here: a combobox
// that filters, a listbox with a moving active option, arrow / Home / End /
// Enter navigation, an empty state, and a polite status region that
// announces the result count. One focus owner, no new dependency.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

export function CommandPalette({
  items,
  query,
  onQueryChange,
  onSelect,
  label = 'Search commands',
  placeholder = 'Search actions, pages, and settings...',
  emptyLabel = 'No matching command.',
  className = '',
  trailing = null
}) {
  const listId = useId()
  const inputId = useId()
  const listRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(() => {
    const needle = String(query || '').trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => item.label.toLowerCase().includes(needle))
  }, [items, query])

  // A new result set always starts at the first option.
  useEffect(() => {
    setActiveIndex(0)
  }, [query, items])

  const activeId = filtered.length ? `${listId}-option-${activeIndex}` : undefined

  const choose = useCallback(
    (item) => {
      if (!item) return
      onSelect?.(item)
    },
    [onSelect]
  )

  const onKeyDown = (event) => {
    if (event.key === 'Escape') return
    if (!filtered.length) {
      if (event.key === 'Enter') event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % filtered.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(filtered.length - 1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(filtered[activeIndex])
    }
  }

  // Keep the active option visible while the arrow keys move through it.
  useEffect(() => {
    if (!activeId || !listRef.current) return
    const option = listRef.current.querySelector(`#${CSS.escape(activeId)}`)
    option?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  return (
    <div className={className} onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2 border-b border-[var(--kt-border)] px-3">
        <input
          id={inputId}
          role="combobox"
          type="text"
          autoFocus
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          className="h-11 w-full bg-transparent py-3 text-sm text-[var(--kt-text)] outline-none placeholder:text-[var(--kt-muted)]"
        />
        {trailing}
      </div>

      <div
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label="Commands"
        className="max-h-80 overflow-y-auto overflow-x-hidden p-2 app-scrollbar"
      >
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--kt-muted)]">{emptyLabel}</p>
        ) : (
          filtered.map((item, index) => (
            <div
              key={item.path}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(item)}
              className={`flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                index === activeIndex
                  ? 'bg-[var(--kt-accent-soft)] text-[var(--kt-accent-text)]'
                  : 'text-[var(--kt-text)]'
              }`}
            >
              {item.icon ? (
                <span className="text-[var(--kt-accent-text)]" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </div>
          ))
        )}
      </div>

      {/* The result count is announced, not only painted. */}
      <p className="sr-only" role="status" aria-live="polite">
        {filtered.length === 0
          ? 'No commands match the search.'
          : `${filtered.length} command${filtered.length === 1 ? '' : 's'} available.`}
      </p>
    </div>
  )
}

export default CommandPalette
