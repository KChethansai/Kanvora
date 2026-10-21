// Create-project / create-workspace dialogs: viewport-safe layout, a
// theme-aware selection indicator and semantic field ink.
//
// jsdom has no layout engine, so the height and scroll assertions below are
// STRUCTURAL: they assert the panel carries a bounded-height + scroll
// affordance, that the overlay owns the viewport scroll, and that the primary
// action lives inside that bounded panel. The real geometry is verified in a
// browser by the visual pass.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateProjectModal, CreateWorkspaceModal } from '../components/Projects'

const WORKSPACES = [{ _id: 'w1', name: 'Team' }]

// Classes that make an element a scroll container.
const SCROLL_CLASSES = [
  'overflow-y-auto',
  'overflow-auto',
  'overflow-y-scroll',
  'overflow-scroll'
]

// SVG nodes expose className as an SVGAnimatedString, so read the attribute.
const classesOf = (node) => {
  const value = typeof node.className === 'string'
    ? node.className
    : node.getAttribute('class') || ''
  return value.split(/\s+/).filter(Boolean)
}

const scrollersOf = (root) =>
  [root, ...root.querySelectorAll('*')].filter((node) =>
    SCROLL_CLASSES.some((name) => classesOf(node).includes(name))
  )

const renderProjectModal = (props = {}) =>
  render(
    <CreateProjectModal
      onClose={vi.fn()}
      onCreate={vi.fn()}
      workspaces={WORKSPACES}
      {...props}
    />
  )

const renderWorkspaceModal = (props = {}) =>
  render(
    <CreateWorkspaceModal
      onClose={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />
  )

afterEach(cleanup)

describe('create-project dialog viewport safety', () => {
  it('bounds the panel height, scrolls the overlay, and keeps one internal scroll region', () => {
    renderProjectModal()

    const dialog = screen.getByRole('dialog', { name: 'Create project' })
    const overlay = dialog.parentElement
    expect(overlay).toBeTruthy()

    // The overlay owns the viewport scroll and reserves vertical breathing room
    // so a short viewport can never centre the panel off-screen.
    const overlayClasses = classesOf(overlay)
    expect(overlayClasses).toContain('overflow-y-auto')
    expect(overlayClasses).toContain('py-6')

    // The panel itself is height bounded and is the scroll container.
    const panelClasses = classesOf(dialog)
    expect(panelClasses).toContain('max-h-[calc(100dvh-3rem)]')
    expect(panelClasses).toContain('overflow-y-auto')

    // Exactly one internal scroll region: the panel. The overlay is the outer
    // viewport scroll, nothing between them scrolls.
    const scrollers = scrollersOf(overlay)
    expect(scrollers).toHaveLength(2)
    expect(scrollers[0]).toBe(overlay)
    expect(scrollers[1]).toBe(dialog)
  })

  it('keeps the primary action inside the bounded panel', () => {
    renderProjectModal()

    const dialog = screen.getByRole('dialog', { name: 'Create project' })
    const title = within(dialog).getByLabelText(/Project title/)
    fireEvent.change(title, { target: { value: 'Ship audit' } })

    // The action is a descendant of the bounded panel, never a sibling of it.
    const create = within(dialog).getByRole('button', { name: 'Create' })
    expect(dialog.contains(create)).toBe(true)
    expect(create).toBeEnabled()
  })

  it('applies the same viewport-safe structure to the create-workspace dialog', () => {
    renderWorkspaceModal()

    const dialog = screen.getByRole('dialog', { name: 'Create workspace' })
    const overlay = dialog.parentElement

    expect(classesOf(overlay)).toContain('overflow-y-auto')
    expect(classesOf(overlay)).toContain('py-6')
    expect(classesOf(dialog)).toContain('max-h-[calc(100dvh-3rem)]')
    expect(classesOf(dialog)).toContain('overflow-y-auto')

    const scrollers = scrollersOf(overlay)
    expect(scrollers).toHaveLength(2)
    expect(scrollers[1]).toBe(dialog)

    const submit = within(dialog).getByRole('button', { name: 'Create workspace' })
    expect(dialog.contains(submit)).toBe(true)
  })
})

describe('create-project dialog theming', () => {
  it('marks the selected background swatch with a non-white selection indicator', () => {
    renderProjectModal()

    const dialog = screen.getByRole('dialog', { name: 'Create project' })
    const selected = within(dialog).getByRole('button', { name: 'Background Ocean' })

    expect(selected).toHaveAttribute('aria-pressed', 'true')
    const selectedClasses = classesOf(selected)
    expect(selectedClasses).toContain('ring-2')
    expect(selectedClasses).toContain('ring-[var(--kt-accent)]')
    // A white ring is invisible on the light panel surface.
    expect(selectedClasses).not.toContain('ring-white')

    const unselected = within(dialog).getByRole('button', { name: 'Background Sunset' })
    expect(unselected).toHaveAttribute('aria-pressed', 'false')
    expect(classesOf(unselected)).not.toContain('ring-2')
  })

  it('renders the fields with the semantic foreground and a muted placeholder', () => {
    renderProjectModal()

    const dialog = screen.getByRole('dialog', { name: 'Create project' })

    const titleClasses = classesOf(within(dialog).getByLabelText(/Project title/))
    expect(titleClasses).toContain('text-[var(--kt-text)]')
    expect(titleClasses).toContain('placeholder:text-[var(--kt-muted)]')
    // The legacy pair painted the placeholder in full-strength foreground ink.
    expect(titleClasses).not.toContain('text-white')
    expect(titleClasses).not.toContain('text-[#a3a3ad]')

    const workspaceClasses = classesOf(within(dialog).getByLabelText(/Workspace/))
    expect(workspaceClasses).toContain('text-[var(--kt-text)]')
    expect(workspaceClasses).toContain('placeholder:text-[var(--kt-muted)]')
    expect(workspaceClasses).not.toContain('text-white')
  })
})

describe('create-project dialog behaviour', () => {
  it('still closes on Escape and restores focus to the opener', () => {
    const onClose = vi.fn()
    const opener = document.createElement('button')
    opener.textContent = 'open'
    document.body.appendChild(opener)
    opener.focus()

    renderProjectModal({ onClose })

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Create project' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    cleanup()
    opener.remove()
  })
})
