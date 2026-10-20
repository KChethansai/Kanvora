import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BsArrowLeft, BsBook, BsSearch, BsX } from 'react-icons/bs'
import { helpArticles, helpCategories, getHelpArticle } from '../content/helpArticles'

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')

const articleText = (article) => normalize([
  article.title, article.summary, article.category, article.note, ...article.keywords, ...article.steps
].join(' '))

export default function Help() {
  const [params, setParams] = useSearchParams()
  const headingRef = useRef(null)
  const query = params.get('q') || ''
  const category = helpCategories.includes(params.get('category')) ? params.get('category') : 'All'
  const selected = getHelpArticle(params.get('article'))

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'All' || value === null) next.delete(key)
    else next.set(key, value)
    if (key === 'q' || key === 'category') next.delete('article')
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const needle = normalize(query).trim()
    return helpArticles.filter((article) => {
      if (category !== 'All' && article.category !== category) return false
      return !needle || articleText(article).includes(needle)
    })
  }, [query, category])

  useEffect(() => {
    if (selected) headingRef.current?.focus()
  }, [selected])

  return (
    <main className="min-h-screen bg-[var(--kt-bg)] px-4 py-10 text-[var(--kt-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kt-accent-text)]">Help center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Answers for the work in front of you</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--kt-muted)] sm:text-base">
            Short, verified guides for Kanvora boards, teams, accounts, and installation. Search a task or
            browse by category; every answer here describes a feature that exists in this app.
          </p>
        </header>

        <section aria-label="Help search" className="mt-8 rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4 shadow-sm sm:p-5">
          <label className="block text-xs font-semibold text-[var(--kt-muted)]" htmlFor="help-search">Search help</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--kt-border)] bg-[var(--kt-bg)] px-3 focus-within:border-[var(--kt-accent)] focus-within:ring-2 focus-within:ring-[var(--kt-accent)]">
            <BsSearch aria-hidden="true" className="shrink-0 text-[var(--kt-muted)]" />
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => update('q', event.target.value)}
              placeholder="Try “invite”, “archive”, or “install”"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-[var(--kt-muted)]"
            />
            {query && (
              <button type="button" onClick={() => update('q', '')} aria-label="Clear search"
                className="rounded-md p-1 text-[var(--kt-muted)] hover:text-[var(--kt-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)]">
                <BsX aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {helpCategories.map((item) => (
              <button key={item} type="button" onClick={() => update('category', item)} aria-pressed={category === item}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)] ${
                  category === item
                    ? 'border-[var(--kt-accent)] bg-[var(--kt-accent-soft)] text-[var(--kt-accent-text)]'
                    : 'border-[var(--kt-border)] text-[var(--kt-muted)] hover:border-[var(--kt-border-strong)] hover:text-[var(--kt-text)]'
                }`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        {selected ? (
          <article aria-labelledby="help-article-title" className="mt-8 rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-5 shadow-sm sm:p-7">
            <button type="button" onClick={() => update('article', null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-[var(--kt-accent-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)]">
              <BsArrowLeft aria-hidden="true" /> All help articles
            </button>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--kt-muted)]">{selected.category}</p>
            <h2 id="help-article-title" ref={headingRef} tabIndex="-1" className="mt-1 text-2xl font-bold tracking-tight focus:outline-none">
              {selected.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--kt-muted)]">{selected.summary}</p>
            <ol className="mt-5 space-y-3">
              {selected.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--kt-accent-soft)] text-xs font-bold text-[var(--kt-accent-text)]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {selected.note && (
              <p className="mt-5 rounded-xl border border-[var(--kt-border)] bg-[var(--kt-bg)] p-3 text-sm leading-6 text-[var(--kt-muted)]">
                {selected.note}
              </p>
            )}
            {selected.routes?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {selected.routes.map((route) => (
                  <Link key={route.to} to={route.to}
                    className="inline-flex rounded-lg bg-[var(--kt-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--kt-on-accent)] hover:bg-[var(--kt-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)]">
                    {route.label}
                  </Link>
                ))}
              </div>
            )}
          </article>
        ) : (
          <section aria-labelledby="help-results-title" className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="help-results-title" className="text-lg font-bold">Browse articles</h2>
              <p aria-live="polite" className="text-xs text-[var(--kt-muted)]">
                {results.length} {results.length === 1 ? 'article' : 'articles'}
                {category !== 'All' ? ` in ${category}` : ''}
              </p>
            </div>
            {results.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--kt-border-strong)] bg-[var(--kt-surface)] p-8 text-center">
                <BsBook aria-hidden="true" className="mx-auto text-2xl text-[var(--kt-muted)]" />
                <p className="mt-3 text-sm font-semibold">No article matches that search.</p>
                <p className="mt-1 text-sm text-[var(--kt-muted)]">Try a shorter task word, or clear the filters.</p>
                <button type="button" onClick={() => setParams({}, { replace: true })}
                  className="mt-4 rounded-lg border border-[var(--kt-border-strong)] px-3.5 py-2 text-sm font-semibold hover:bg-[var(--kt-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)]">
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {results.map((article) => (
                  <li key={article.id}>
                    <button type="button" onClick={() => update('article', article.id)}
                      className="h-full w-full rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-5 text-left shadow-sm transition hover:border-[var(--kt-border-strong)] hover:bg-[var(--kt-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-accent)]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--kt-accent-text)]">{article.category}</span>
                      <span className="mt-2 block text-base font-bold">{article.title}</span>
                      <span className="mt-1.5 block text-sm leading-6 text-[var(--kt-muted)]">{article.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
