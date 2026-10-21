// Overlay focus ownership: when two overlays are open only the topmost one
// traps focus, consumes Escape and wraps Tab. The lower overlay must suspend
// instead of fighting for the focus.
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useDialogFocus from '../hooks/useDialogFocus'

function Dialog({ open, onClose, label, children }) {
  const ref = useDialogFocus(open, onClose)
  if (!open) return null
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  )
}

// Two stacked overlays. The child mounts after the parent, so the child owns
// the focus while both are open.
function Harness({ onParentClose = () => {}, onChildClose = () => {} }) {
  const [parentOpen, setParentOpen] = useState(false)
  const [childOpen, setChildOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setParentOpen(true)}>Open parent</button>
      <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
      <button type="button">Outside control</button>

      <Dialog
        open={parentOpen}
        onClose={() => { setParentOpen(false); onParentClose() }}
        label="Parent dialog"
      >
        <button type="button">Parent only</button>
        <button type="button" data-autofocus>Parent preferred</button>
      </Dialog>

      <Dialog
        open={childOpen}
        onClose={() => { setChildOpen(false); onChildClose() }}
        label="Child dialog"
      >
        <button type="button">Child first</button>
        <button type="button" data-autofocus>Child preferred</button>
        <button type="button">Child last</button>
      </Dialog>
    </>
  )
}

const openParent = () => {
  const opener = screen.getByRole('button', { name: 'Open parent' })
  opener.focus()
  fireEvent.click(opener)
  return screen.getByRole('dialog', { name: 'Parent dialog' })
}

const openChild = () => {
  const opener = screen.getByRole('button', { name: 'Open child' })
  opener.focus()
  fireEvent.click(opener)
  return screen.getByRole('dialog', { name: 'Child dialog' })
}

const runtimeErrors = []
const recordError = (event) => {
  runtimeErrors.push(event.error?.message || event.message || String(event.error))
}

beforeEach(() => {
  runtimeErrors.length = 0
  window.addEventListener('error', recordError)
})

afterEach(() => {
  window.removeEventListener('error', recordError)
  cleanup()
})

describe('overlay focus stack', () => {
  it('keeps focus inside the topmost dialog when Tab is pressed and never overflows the stack', () => {
    render(<Harness />)
    openParent()
    const child = openChild()

    const last = screen.getByRole('button', { name: 'Child last' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })

    expect(runtimeErrors.join(' | ')).not.toMatch(/Maximum call stack/i)
    expect(child).toContainElement(document.activeElement)
    expect(screen.getByRole('button', { name: 'Child first' })).toHaveFocus()
  })

  it('closes only the topmost dialog when Escape is pressed', () => {
    const onParentClose = vi.fn()
    const onChildClose = vi.fn()
    render(<Harness onParentClose={onParentClose} onChildClose={onChildClose} />)
    openParent()
    const child = openChild()

    fireEvent.keyDown(child, { key: 'Escape' })

    expect(onChildClose).toHaveBeenCalledTimes(1)
    expect(onParentClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Child dialog' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Parent dialog' })).toBeInTheDocument()
  })

  it('returns focus into the overlay below when the topmost dialog closes', () => {
    render(<Harness />)
    const parent = openParent()
    const child = openChild()

    fireEvent.keyDown(child, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Child dialog' })).not.toBeInTheDocument()
    expect(parent).toContainElement(document.activeElement)
    expect(screen.getByRole('button', { name: 'Parent preferred' })).toHaveFocus()
  })

  it('pulls focus back to the topmost dialog when focus lands outside it', () => {
    render(<Harness />)
    openParent()
    openChild()

    const outside = screen.getByRole('button', { name: 'Outside control' })
    outside.focus()

    expect(runtimeErrors.join(' | ')).not.toMatch(/Maximum call stack/i)
    expect(screen.getByRole('button', { name: 'Child preferred' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Parent preferred' })).not.toHaveFocus()
  })
})
