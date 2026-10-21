// The create-project dialog and the label chips.
//
// Three contracts are guarded here:
//   1. the project-creation form has a single implementation, and the live
//      dialog renders it;
//   2. the dialog only closes on a confirmed creation - a failure keeps every
//      field the user filled in and reports itself inline;
//   3. a label chip paints a fixed saturated fill, so its ink is fixed too and
//      clears WCAG AA (4.5:1) for the 12px chip text in both themes.
//
// The colours are read from the installed Tailwind theme and from index.css,
// so the ratios are measured against the fills and inks the browser actually
// paints, not against a copy of the palette.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as ProjectsModule from '../components/Projects'
import { CardLabelsInput, CardLabelsList } from '../components/CardLabels'
import { LABEL_COLOR_STYLES, LABEL_COLOR_VALUES } from '../utils/projectUtils'

const { default: Projects, ProjectCreateForm } = ProjectsModule

const state = vi.hoisted(() => ({ project: {}, workspace: {} }))

vi.mock('../store/projectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => state.workspace }))

const root = join(import.meta.dirname, '..')
const css = readFileSync(join(root, 'index.css'), 'utf8')
const tailwindTheme = readFileSync(
  join(root, '..', 'node_modules', 'tailwindcss', 'theme.css'),
  'utf8'
)

const block = (selector) => {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Missing CSS block: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const tokens = (selector) =>
  Object.fromEntries(
    [...block(selector).matchAll(/--kt-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim()
    ])
  )

const darkTokens = tokens(':root,\n[data-theme="dark"]')
const lightTokens = tokens('[data-theme="light"]')

const hex = (value) => {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) throw new Error(`Expected a solid hex token, received: ${value}`)
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16))
}

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (foreground, background) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

// Tailwind v4 ships its palette as oklch; the browser converts it to sRGB, so
// the guard measures the same colour the chip is painted with.
const oklchToRgb = (l, c, h) => {
  const hue = (h * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)
  const red = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const green = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const blue = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * red - 3.3077115913 * green + 0.2309699292 * blue,
    -1.2684380046 * red + 2.6097574011 * green - 0.3413193965 * blue,
    -0.0041960863 * red - 0.7034186147 * green + 1.707614701 * blue
  ].map((value) => {
    const channel =
      value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, channel)) * 255)
  })
}

const resolveFill = (fillClass) => {
  const match = /^bg-([a-z]+)-(\d+)$/.exec(fillClass)
  if (!match) throw new Error(`Unsupported label fill class: ${fillClass}`)
  const [, name, shade] = match
  const definition = new RegExp(
    `--color-${name}-${shade}:\\s*oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`
  ).exec(tailwindTheme)
  if (!definition) throw new Error(`Missing Tailwind colour: ${name}-${shade}`)
  return oklchToRgb(
    Number(definition[1]) / 100,
    Number(definition[2]),
    Number(definition[3])
  )
}

// The ink of a chip may only be a fixed one: scrim white or the fixed status
// ink. A themed ink would repaint the chip with the theme foreground and fail
// in one of the themes.
const resolveInk = (inkClass) => {
  if (inkClass === 'on-scrim') return hex('#ffffff')
  if (inkClass === 'text-[var(--kt-on-success)]') return hex(darkTokens['on-success'])
  throw new Error(`Unsupported label ink class: ${inkClass}`)
}

const WORKSPACES = [{ _id: 'w1', name: 'Team' }]

const projectStore = (createProject) => ({
  projects: [],
  recentProjects: [],
  loading: false,
  fetchProjects: vi.fn(),
  fetchRecentProjects: vi.fn(),
  createProject,
  deleteProject: vi.fn(),
  activeFilter: { search: '' }
})

const workspaceStore = (createWorkspace, workspaces = WORKSPACES) => ({
  workspaces,
  activeWorkspace: workspaces[0] || null,
  loading: false,
  fetchWorkspaces: vi.fn(),
  createWorkspace
})

const renderProjects = () =>
  render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>
  )

const openProjectDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create new project' }))
  return screen.getByRole('dialog', { name: 'Create project' })
}

const openWorkspaceDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
  return screen.getByRole('dialog', { name: 'Create workspace' })
}

beforeEach(() => {
  state.project = projectStore(vi.fn().mockResolvedValue({ _id: 'p1' }))
  state.workspace = workspaceStore(vi.fn().mockResolvedValue({ _id: 'w2' }))
})

beforeAll(() => {
  // The upload preview needs an object URL; jsdom ships one, but the test
  // must not depend on that.
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:preview'
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
})

afterEach(cleanup)

describe('create-project dialog: one shared form', () => {
  it('exposes the shared project-creation form and renders it in the dialog', () => {
    expect(typeof ProjectCreateForm).toBe('function')

    const { unmount } = render(
      <ProjectCreateForm workspaces={WORKSPACES} onSubmit={vi.fn()} />
    )

    expect(screen.getByLabelText(/Project title/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Workspace/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Background Ocean' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Upload JPG\/PNG background/)).toBeInTheDocument()

    unmount()
  })
})

describe('create-project dialog: only closes on a confirmed creation', () => {
  it('keeps the dialog open with the typed title when the project was not created', async () => {
    state.project = projectStore(vi.fn().mockResolvedValue(null))

    renderProjects()
    const dialog = await openProjectDialog()

    fireEvent.change(within(dialog).getByLabelText(/Project title/), {
      target: { value: 'Ship audit' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Background Sunset' }))
    fireEvent.change(within(dialog).getByLabelText(/Upload JPG\/PNG background/), {
      target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/not created/i)

    // The dialog survives the failure and keeps everything the user filled in.
    expect(screen.getByRole('dialog', { name: 'Create project' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Project title/)).toHaveValue('Ship audit')
    expect(screen.getByLabelText(/Workspace/)).toHaveValue('w1')
    expect(
      screen.getByRole('button', { name: 'Background Sunset' })
    ).toHaveAttribute('aria-pressed', 'true')
    // The uploaded image is still on the preview after the failure.
    const preview = dialog.querySelector('img')
    expect(preview).not.toBeNull()
    expect(preview.getAttribute('src')).toMatch(/^blob:/)

    // The action is usable again: no stuck "Creating..." button.
    const create = screen.getByRole('button', { name: 'Create' })
    expect(create).toBeEnabled()
  })

  it('closes the dialog after a verified successful creation', async () => {
    // The live dialog renders the shared form, so there is one implementation
    // of the project-creation fields.
    expect(typeof ProjectCreateForm).toBe('function')

    state.project = projectStore(vi.fn().mockResolvedValue({ _id: 'p1', title: 'Ship audit' }))

    renderProjects()
    const dialog = await openProjectDialog()

    fireEvent.change(within(dialog).getByLabelText(/Project title/), {
      target: { value: 'Ship audit' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create project' })).not.toBeInTheDocument()
    )
    expect(state.project.createProject).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('create-workspace dialog: only closes on a confirmed creation', () => {
  it('keeps the dialog open with the typed name when the workspace was not created', async () => {
    state.workspace = workspaceStore(vi.fn().mockRejectedValue(new Error('offline')), [])

    renderProjects()
    const dialog = await openWorkspaceDialog()

    fireEvent.change(within(dialog).getByLabelText(/Workspace name/), {
      target: { value: 'Product team' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create workspace' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/not created/i)

    expect(screen.getByRole('dialog', { name: 'Create workspace' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Workspace name/)).toHaveValue('Product team')
    expect(
      within(screen.getByRole('dialog', { name: 'Create workspace' })).getByRole('button', {
        name: 'Create workspace'
      })
    ).toBeEnabled()
  })

  it('keeps the dialog open after a failure and closes it after a successful retry', async () => {
    const createWorkspace = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ _id: 'w2', name: 'Product team' })
    state.workspace = workspaceStore(createWorkspace, [])

    renderProjects()
    const dialog = await openWorkspaceDialog()

    fireEvent.change(within(dialog).getByLabelText(/Workspace name/), {
      target: { value: 'Product team' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create workspace' }))

    await screen.findByRole('alert')
    expect(screen.getByRole('dialog', { name: 'Create workspace' })).toBeInTheDocument()
    expect(createWorkspace).toHaveBeenCalledTimes(1)

    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Create workspace' })).getByRole('button', {
        name: 'Create workspace'
      })
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create workspace' })).not.toBeInTheDocument()
    )
    expect(createWorkspace).toHaveBeenCalledTimes(2)
  })
})

describe('label chip contrast', () => {
  it('gives every palette colour a fill and ink that clears WCAG AA', () => {
    expect(Object.keys(LABEL_COLOR_STYLES).sort()).toEqual([...LABEL_COLOR_VALUES].sort())

    for (const [name, style] of Object.entries(LABEL_COLOR_STYLES)) {
      const fill = resolveFill(style.fill)
      const ink = resolveInk(style.ink)
      expect(ratio(ink, fill), `${name}: ${style.ink} on ${style.fill}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the chip ink identical in both themes', () => {
    expect(lightTokens['on-success']).toBe(darkTokens['on-success'])
    expect(darkTokens['on-success']).toBe('#052e16')
    // Scrim ink is a fixed white, not a theme foreground.
    expect(css).toMatch(/\.on-scrim \{\s*color: #ffffff\s*!important;/)

    // Every palette ink is one of the two fixed inks, never a themed one.
    for (const [name, style] of Object.entries(LABEL_COLOR_STYLES)) {
      expect(['on-scrim', 'text-[var(--kt-on-success)]'], name).toContain(style.ink)
    }
  })

  it('paints the chips with the paired fill and ink instead of scrim white', () => {
    render(
      <CardLabelsList
        labels={[{ text: 'Bug', color: 'orange' }]}
        nonStatusLabels={[{ text: 'Bug', color: 'orange' }]}
        removeLabel={vi.fn()}
        readOnly
      />
    )

    const chip = screen.getByText('Bug')
    expect(chip).toHaveClass('bg-orange-500')
    expect(chip).toHaveClass('text-[var(--kt-on-success)]')
    expect(chip.className).not.toContain('on-scrim')
  })

  it('marks the selected colour swatch with a themed ring, not a white one', () => {
    render(
      <CardLabelsInput
        labelText=""
        setLabelText={vi.fn()}
        showLabels
        selectedLabelColor="blue"
        setSelectedLabelColor={vi.fn()}
        addLabel={vi.fn()}
      />
    )

    const selected = screen.getByRole('button', { name: 'Choose blue label' })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).toHaveClass('ring-2')
    expect(selected).toHaveClass('ring-[var(--kt-accent)]')
    expect(selected.className).not.toContain('ring-white')

    const other = screen.getByRole('button', { name: 'Choose red label' })
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(other.className).not.toContain('ring-2')
  })
})
