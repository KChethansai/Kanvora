// The card editor must send only what the user changed.
//
// The payload helper is a pure function, so it is unit tested on its own. This
// test covers the editor itself: the payload that reaches the save handler,
// and the case where the user changed nothing at all.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardDetailModal from '../components/CardDetailModal'

const card = {
  _id: 'card-1',
  title: 'Ship the audit',
  description: 'Original description',
  richDescription: 'Original description',
  priority: 'MEDIUM',
  labels: [{ text: 'Todo', color: 'blue' }],
  estimatedMinutes: 30,
  recurring: { enabled: false, interval: 'NONE', nextRunAt: null },
  subtasks: [],
  checklists: [],
  memberIds: []
}

const renderModal = (onSave, onClose = vi.fn()) => render(
  <MemoryRouter>
    <CardDetailModal
      card={card}
      listTitle="To do"
      onClose={onClose}
      onSave={onSave}
      onDelete={vi.fn()}
      onStatusChange={vi.fn()}
      onAttach={vi.fn()}
      currentUser={{ _id: 'user-1', name: 'Ada' }}
    />
  </MemoryRouter>
)

afterEach(() => cleanup())

describe('card editor save payload', () => {
  it('sends only the field the user edited', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    await act(async () => { renderModal(onSave) })

    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Ship the audit now' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledWith('card-1', { title: 'Ship the audit now' })
  })

  it('does not save at all when the user changed nothing', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    await act(async () => { renderModal(onSave, onClose) })

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('sends a field the user cleared', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    await act(async () => { renderModal(onSave) })

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0][1]
    expect(payload).toHaveProperty('description', '')
    expect(payload).not.toHaveProperty('title')
    expect(payload).not.toHaveProperty('labels')
  })

  it('refuses to save a card whose checklist title is blank', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    const withChecklist = {
      ...card,
      checklists: [{ _id: 'checklist-1', title: 'Steps', items: [{ title: 'one', completed: false }] }]
    }

    await act(async () => {
      render(
        <MemoryRouter>
          <CardDetailModal
            card={withChecklist}
            listTitle="To do"
            onClose={onClose}
            onSave={onSave}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            onAttach={vi.fn()}
            currentUser={{ _id: 'user-1', name: 'Ada' }}
          />
        </MemoryRouter>
      )
    })

    const titleInput = screen.getByDisplayValue('Steps')
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: '   ' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })

    // The server would answer 400, so the request must not be made at all.
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    // The draft the user typed is still there.
    expect(screen.getByPlaceholderText('Checklist name').value).toBe('   ')
    expect(screen.getByText(/This checklist needs a name/i)).toBeTruthy()
    expect(screen.getByText(/Give each checklist a name/i)).toBeTruthy()
  })
})
