// Help content truthfulness for list ordering: the copy must describe the
// grip handle and the keyboard-friendly move actions that the board offers.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import Help from '../components/Help'
import { helpArticles } from '../content/helpArticles'

const articleText = (article) =>
  [article.summary, article.note, ...article.steps].join(' ')

const orderingArticle = () => {
  const article = helpArticles.find((entry) => entry.id === 'reorder-and-move')
  expect(article, 'the reorder-and-move article must exist').toBeTruthy()
  return article
}

describe('help ordering copy', () => {
  it('keeps the curated set at 14 articles', () => {
    expect(helpArticles).toHaveLength(14)
  })

  it('tells the reader that a list is dragged by its grip handle', () => {
    expect(articleText(orderingArticle())).toMatch(/grip handle/i)
  })

  it('tells the reader about the Move list left and Move list right actions', () => {
    const text = articleText(orderingArticle())

    expect(text).toMatch(/Move list left/)
    expect(text).toMatch(/Move list right/)
  })

  it('shows the ordering guidance in the rendered article', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Help />
      </MemoryRouter>
    )

    fireEvent.click(
      screen.getByRole('button', { name: /Reorder lists and move cards/i })
    )

    expect(screen.getByText(/grip handle/i)).toBeInTheDocument()
    expect(screen.getByText(/Move list left or Move list right/i)).toBeInTheDocument()
  })
})
