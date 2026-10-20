import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import Help from '../components/Help'

const renderHelp = () => render(
  <MemoryRouter initialEntries={['/help']}>
    <Help />
  </MemoryRouter>
)

describe('help center', () => {
  it('searches curated articles and opens a deep-linked detail view', () => {
    renderHelp()
    expect(screen.getByRole('heading', { name: /Answers for the work/i })).toBeInTheDocument()
    expect(screen.getByText('14 articles')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search help'), { target: { value: 'install' } })
    fireEvent.click(screen.getByRole('button', { name: /Install Kanvora on your device/i }))

    expect(screen.getByRole('heading', { name: 'Install Kanvora on your device' })).toBeInTheDocument()
    expect(screen.getByText(/does not queue board changes while offline/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /All help articles/i }))
    expect(screen.getByRole('heading', { name: 'Browse articles' })).toBeInTheDocument()
  })

  it('filters by category and fails closed on an empty search', () => {
    renderHelp()
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText(/in Account/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create a board/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search help'), { target: { value: 'zzzz-no-match' } })
    expect(screen.getByText('No article matches that search.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('14 articles')).toBeInTheDocument()
  })
})
