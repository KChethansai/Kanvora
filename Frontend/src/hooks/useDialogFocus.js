import { useEffect, useRef } from 'react'

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// Keep callback identity out of the lifecycle: inline close callbacks are safe.
export default function useDialogFocus(open, onClose) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open || !ref.current) return
    const previous = document.activeElement
    const dialog = ref.current
    const items = () => [...dialog.querySelectorAll(focusable)].filter(
      (node) => node.tabIndex >= 0 && !node.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none'
    )
    const firstFocus = () => {
      const preferred = dialog.querySelector('[data-autofocus]')
      const target = preferred && items().includes(preferred) ? preferred : items()[0] || dialog
      target.focus()
    }
    firstFocus()
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current?.()
      }
      if (event.key !== 'Tab') return
      const nodes = items()
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
      if (!dialog.contains(event.target)) firstFocus()
    }
    dialog.addEventListener('keydown', handleKey)
    document.addEventListener('focusin', keepFocus)
    return () => {
      dialog.removeEventListener('keydown', handleKey)
      document.removeEventListener('focusin', keepFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])
  return ref
}
