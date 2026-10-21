import { useEffect, useRef } from 'react'

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// One focus owner at a time. Dialogs are pushed in mount order; only the
// topmost entry may trap focus, consume Escape, or wrap Tab. Lower entries stay
// mounted and resume ownership when the overlay above them closes.
const dialogStack = []

const isTopmost = (record) => dialogStack.at(-1) === record

const focusableItems = (dialog) => [...dialog.querySelectorAll(focusable)].filter(
  (node) => node.tabIndex >= 0 &&
    !node.closest('[hidden], [inert], [aria-hidden="true"]') &&
    getComputedStyle(node).visibility !== 'hidden' &&
    getComputedStyle(node).display !== 'none'
)

const focusFirst = (dialog) => {
  const preferred = dialog.querySelector('[data-autofocus]')
  const items = focusableItems(dialog)
  const target = preferred && items.includes(preferred) ? preferred : items[0] || dialog
  target.focus()
}

// Keep callback identity out of the lifecycle: inline close callbacks are safe.
export default function useDialogFocus(open, onClose) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    const record = {
      dialog,
      previous: document.activeElement,
      focusFirst: () => focusFirst(dialog)
    }
    dialogStack.push(record)
    record.focusFirst()

    const handleKey = (event) => {
      if (!isTopmost(record)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      // The wrap only applies while the focus is inside the dialog. The
      // focusin guard already pulls a stray focus back, so the tab order of
      // the rest of the page is left alone.
      if (!dialog.contains(document.activeElement)) return
      const nodes = focusableItems(dialog)
      const first = nodes[0]
      const last = nodes.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    const keepFocus = (event) => {
      // A lower dialog must never pull focus out of the overlay above it. This
      // check is what prevents mutually recursive focus redirects.
      if (!isTopmost(record)) return
      if (!dialog.contains(event.target)) record.focusFirst()
    }
    // The key handler lives on the document, not on the dialog: a dialog must
    // still close with Escape when the focus moved elsewhere, for example to a
    // toast that reported a failed action. The stack keeps the ownership
    // exclusive, so only the topmost overlay reacts.
    document.addEventListener('keydown', handleKey)
    document.addEventListener('focusin', keepFocus)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('focusin', keepFocus)
      const index = dialogStack.indexOf(record)
      const wasTopmost = index === dialogStack.length - 1
      if (index !== -1) dialogStack.splice(index, 1)
      if (!wasTopmost) return
      const next = dialogStack.at(-1)
      if (next) next.focusFirst()
      else if (record.previous?.isConnected) record.previous.focus()
    }
  }, [open])
  return ref
}
