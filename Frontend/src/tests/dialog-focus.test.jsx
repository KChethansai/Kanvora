import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useDialogFocus from '../hooks/useDialogFocus'

function TestDialog({ open, onClose }) {
  const ref = useDialogFocus(open, onClose)
  if (!open) return null
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button" data-autofocus>Preferred</button>
      <button type="button">Last</button>
    </div>
  )
}

function Harness({ onClose = () => {} } = {}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <TestDialog open={open} onClose={() => { setOpen(false); onClose() }} />
    </>
  )
}

const openDialog = () => {
  const opener = screen.getByRole('button', { name: 'Open dialog' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: screen.getByRole('dialog', { name: 'Test dialog' }) }
}

afterEach(cleanup)

describe('useDialogFocus', () => {
  it('moves initial focus to the preferred control inside the dialog', () => {
    render(<Harness />)
    openDialog()
    expect(screen.getByRole('button', { name: 'Preferred' })).toHaveFocus()
  })

  it('wraps Tab from the last control to the first', () => {
    render(<Harness />)
    openDialog()
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Harness />)
    openDialog()
    const first = screen.getByRole('button', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('pulls focus back when something outside the dialog is focused', () => {
    render(<Harness />)
    const { opener } = openDialog()
    opener.focus()
    expect(screen.getByRole('button', { name: 'Preferred' })).toHaveFocus()
  })

  it('closes on Escape and restores focus to the opener', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const { opener, dialog } = openDialog()

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
