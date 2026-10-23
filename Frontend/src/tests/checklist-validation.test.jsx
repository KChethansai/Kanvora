// Checklist validation.
//
// The checklist payload is always the whole array, so one blank title makes
// every quick update invalid. The editor must say why instead of firing a
// request the server answers with 400, and it must keep the draft.
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CardChecklists from '../components/CardChecklists'

const twoChecklists = () => ([
  {
    _id: 'c1',
    title: 'Steps',
    items: [{ _id: 'i1', title: 'one', completed: false }]
  },
  {
    _id: 'c2',
    title: 'Review',
    items: [{ _id: 'i2', title: 'two', completed: false }]
  }
])

function Harness({ initial, onQuickUpdate }) {
  const [checklists, setChecklists] = useState(initial)
  const [newChecklistItemTitles, setNewChecklistItemTitles] = useState({})
  return (
    <CardChecklists
      cardId="card-1"
      checklists={checklists}
      setChecklists={setChecklists}
      newChecklistItemTitles={newChecklistItemTitles}
      setNewChecklistItemTitles={setNewChecklistItemTitles}
      onQuickUpdate={onQuickUpdate}
    />
  )
}

const renderWith = (initial) => {
  const onQuickUpdate = vi.fn()
  render(<Harness initial={initial} onQuickUpdate={onQuickUpdate} />)
  return onQuickUpdate
}

afterEach(cleanup)

describe('checklist title validation', () => {
  it('marks a blank title invalid and withholds the request', () => {
    const onQuickUpdate = renderWith(twoChecklists())
    const input = screen.getByDisplayValue('Steps')

    fireEvent.change(input, { target: { value: '   ' } })

    // The draft is preserved exactly as typed.
    expect(screen.getAllByPlaceholderText('Checklist name')[0].value).toBe('   ')
    // The request is withheld: the server rejects the whole array.
    expect(onQuickUpdate).not.toHaveBeenCalled()
    // And the reason is announced.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This checklist needs a name before the card can be saved.'
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'checklist-title-error-0')
  })

  it('clears the error and resumes saving once the title is valid again', () => {
    const onQuickUpdate = renderWith(twoChecklists())
    const input = screen.getByDisplayValue('Steps')

    fireEvent.change(input, { target: { value: '' } })
    expect(onQuickUpdate).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'S' } })

    expect(onQuickUpdate).toHaveBeenCalledTimes(1)
    expect(onQuickUpdate.mock.calls[0][1].checklists[0].title).toBe('S')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('withholds an edit to a different checklist while any title is blank', () => {
    const onQuickUpdate = renderWith(twoChecklists())

    fireEvent.change(screen.getByDisplayValue('Review'), { target: { value: '  ' } })
    expect(onQuickUpdate).not.toHaveBeenCalled()

    // Toggling an item in the *other* checklist still carries the blank title
    // in the array, so it must be withheld too.
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    expect(onQuickUpdate).not.toHaveBeenCalled()
    // The local checkbox still reflects the click, so nothing is lost from the
    // draft; it persists on the first save after the title is restored.
    expect(checkboxes[0].checked).toBe(true)
  })

  it('withholds adding an item while a title is blank but keeps the typed item', () => {
    const onQuickUpdate = renderWith(twoChecklists())

    fireEvent.change(screen.getByDisplayValue('Steps'), { target: { value: ' ' } })

    const addItem = screen.getAllByPlaceholderText('Add an item...')[0]
    fireEvent.change(addItem, { target: { value: 'three' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])

    expect(onQuickUpdate).not.toHaveBeenCalled()
    // The item is in the draft even though it was not sent.
    expect(screen.getByText('three')).toBeInTheDocument()
  })

  it('does not render an error for a card with no checklists', () => {
    renderWith([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
