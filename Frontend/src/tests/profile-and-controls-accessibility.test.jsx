// Accessibility fixes: labelled fields, real buttons for label removal,
// keyboard-visible delete controls, a menu-shaped project status popup,
// list move actions, an inert mobile drawer and a usable mobile header menu.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { DndContext } from '@dnd-kit/core'
import UserProfile from '../components/UserProfile'
import { CardLabelsList } from '../components/CardLabels'
import CardSubtasks from '../components/CardSubtasks'
import CardChecklists from '../components/CardChecklists'
import Notifications from '../components/Notifications'
import Project from '../components/Project'
import { ListColumn } from '../components/ListColumn'
import Templates from '../components/Templates'
import Header from '../components/Header'

const router = vi.hoisted(() => ({
  params: { projectId: 'p', id: 'tpl-1' },
  navigate: vi.fn(),
  location: { pathname: '/', search: '' }
}))
const auth = vi.hoisted(() => ({
  currentUser: {
    _id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'ADMIN'
  },
  isAuthenticated: false,
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  checkAuth: vi.fn()
}))
const workspace = vi.hoisted(() => ({
  activeWorkspace: null,
  fetchWorkspace: vi.fn()
}))
const notificationState = vi.hoisted(() => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteNotif: vi.fn(),
  acceptInvite: vi.fn(),
  rejectInvite: vi.fn(),
  bindUserRoom: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    defaults: {},
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
vi.mock('react-router-dom', () => ({
  useParams: () => router.params,
  useNavigate: () => router.navigate,
  useLocation: () => router.location
}))
vi.mock('../store/authStore', () => ({ useAuth: () => auth }))
vi.mock('../store/workspaceStore', () => ({ useWorkspaceStore: () => workspace }))
vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => notificationState
}))
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  })
}))

const boardPayload = {
  _id: 'p',
  title: 'Board',
  capabilities: { read: true, edit: true, manage: true, restore: true },
  members: []
}

const serveBoard = () => {
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/projects/p/lists')) {
      return {
        data: {
          payload: [{ _id: 'list-1', projectId: 'p', title: 'To Do', order: 0 }]
        }
      }
    }
    if (url.includes('/cards')) return { data: { payload: [] } }
    return { data: { payload: boardPayload } }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.currentUser = {
    _id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'ADMIN'
  }
  auth.isAuthenticated = false
  auth.updateProfile.mockResolvedValue(undefined)
  auth.changePassword.mockResolvedValue(undefined)
  auth.checkAuth.mockResolvedValue(undefined)
  notificationState.notifications = []
  notificationState.loading = false
  notificationState.unreadCount = 0
  router.params = { projectId: 'p', id: 'tpl-1' }
})

afterEach(cleanup)

describe('profile form accessibility', () => {
  it('associates every profile field label with its control', () => {
    render(<UserProfile />)

    expect(screen.getByLabelText('Full Name')).toHaveAttribute('id', 'profile-name')
    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'profile-username')
    expect(screen.getByLabelText('Bio')).toHaveAttribute('id', 'profile-bio')
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'profile-email')
  })

  it('associates every password field label with its control', () => {
    render(<UserProfile />)
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(screen.getByLabelText('Current password')).toHaveAttribute(
      'id',
      'profile-current-password'
    )
    expect(screen.getByLabelText('New password')).toHaveAttribute('id', 'profile-new-password')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute(
      'id',
      'profile-confirm-password'
    )
  })

  it('announces a validation error and points the field at its message', async () => {
    render(<UserProfile />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Name is required')
    expect(alert).toHaveAttribute('id', 'profile-name-error')
    expect(screen.getByLabelText('Full Name')).toHaveAttribute(
      'aria-describedby',
      'profile-name-error'
    )
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('lets a global administrator edit their own profile and change their own password', () => {
    render(<UserProfile />)

    expect(screen.queryByText(/Admins cannot modify users directly/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.getByLabelText('Full Name')).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
  })

  it('explains that the email address cannot be changed from the profile', () => {
    render(<UserProfile />)

    expect(
      screen.getByText(/Email is managed by your account and cannot be changed from this profile/i)
    ).toBeInTheDocument()
  })
})

describe('label removal control', () => {
  it('removes a label through a button with an accessible name', () => {
    const removeLabel = vi.fn()
    render(
      <CardLabelsList
        labels={[{ text: 'Bug', color: '#ef4444' }]}
        nonStatusLabels={[{ text: 'Bug', color: '#ef4444' }]}
        removeLabel={removeLabel}
        readOnly={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove label Bug' }))

    expect(removeLabel).toHaveBeenCalledWith(0)
  })

  it('renders a read-only label without a remove control', () => {
    render(
      <CardLabelsList
        labels={[{ text: 'Bug', color: '#ef4444' }]}
        nonStatusLabels={[{ text: 'Bug', color: '#ef4444' }]}
        removeLabel={vi.fn()}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: 'Remove label Bug' })).not.toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
  })
})

describe('keyboard visible delete controls', () => {
  it('keeps the subtask delete control visible for keyboard users', () => {
    render(
      <CardSubtasks
        cardId="card-1"
        subtasks={[{ title: 'Subtask one', completed: false }]}
        setSubtasks={vi.fn()}
        newSubtaskTitle=""
        setNewSubtaskTitle={vi.fn()}
        onQuickUpdate={vi.fn()}
        readOnly={false}
      />
    )

    const remove = screen.getByRole('button', { name: 'Remove subtask' })
    expect(remove.className).toContain('focus-visible:opacity-100')
    expect(remove.className).toContain('group-focus-within:opacity-100')
  })

  it('keeps the checklist item delete control visible for keyboard users', () => {
    render(
      <CardChecklists
        cardId="card-1"
        checklists={[{ title: 'Checklist', items: [{ title: 'Item one', completed: false }] }]}
        setChecklists={vi.fn()}
        newChecklistItemTitles={{}}
        setNewChecklistItemTitles={vi.fn()}
        onQuickUpdate={vi.fn()}
        readOnly={false}
      />
    )

    const remove = screen.getByRole('button', { name: 'Remove item' })
    expect(remove.className).toContain('focus-visible:opacity-100')
    expect(remove.className).toContain('group-focus-within:opacity-100')
  })

  it('keeps the notification delete control visible for keyboard users', () => {
    notificationState.notifications = [
      {
        _id: 'notification-1',
        type: 'activity',
        message: 'A card moved',
        read: false,
        createdAt: new Date().toISOString()
      }
    ]

    render(<Notifications />)

    const remove = screen.getByRole('button', { name: 'Delete notification' })
    expect(remove.className).toContain('focus-visible:opacity-100')
    expect(remove.className).toContain('group-focus-within:opacity-100')
  })
})

describe('project status menu', () => {
  it('exposes the status popup as a menu with radio items', async () => {
    serveBoard()
    render(<Project />)

    const trigger = await screen.findByRole('button', { name: 'Project status labels' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    const menu = await screen.findByRole('menu', { name: 'Project status' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const entries = within(menu).getAllByRole('menuitemradio')
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry).toHaveAttribute('aria-checked')
    }
  })

  it('closes the status popup on Escape and returns focus to its trigger', async () => {
    serveBoard()
    render(<Project />)

    const trigger = await screen.findByRole('button', { name: 'Project status labels' })
    fireEvent.click(trigger)
    const menu = await screen.findByRole('menu', { name: 'Project status' })

    fireEvent.keyDown(menu, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Project status' })).toBeNull())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })
})

describe('list actions menu', () => {
  const renderList = (props = {}) => {
    const onMoveList = props.onMoveList || vi.fn()
    render(
      <DndContext>
        <ListColumn
          list={{ _id: 'list-1', projectId: 'p', title: 'To Do', order: 0 }}
          cards={[]}
          onAddCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDeleteList={vi.fn()}
          onOpenCard={vi.fn()}
          onQuickUpdate={vi.fn()}
          onUpdateList={vi.fn()}
          onStatusList={vi.fn()}
          onMoveList={onMoveList}
          canMoveLeft
          canMoveRight
          isEditable
          {...props}
        />
      </DndContext>
    )
    return { onMoveList }
  }

  it('moves a list left and right from the list actions menu', () => {
    const { onMoveList } = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'List actions for To Do' }))

    fireEvent.click(screen.getByRole('menuitem', { name: 'Move list right' }))
    expect(onMoveList).toHaveBeenCalledWith('list-1', 1)

    fireEvent.click(screen.getByRole('button', { name: 'List actions for To Do' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move list left' }))
    expect(onMoveList).toHaveBeenCalledWith('list-1', -1)
  })

  it('disables the move actions at the board boundaries', () => {
    renderList({ canMoveLeft: false, canMoveRight: false })
    fireEvent.click(screen.getByRole('button', { name: 'List actions for To Do' }))

    expect(screen.getByRole('menuitem', { name: 'Move list left' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Move list right' })).toBeDisabled()
  })
})

describe('template categories drawer', () => {
  it('hides the closed drawer from assistive technology on small screens', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
    axios.get.mockResolvedValue({ data: { payload: [] } })

    render(<Templates />)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())

    const drawer = document.getElementById('template-categories')
    expect(drawer).not.toBeNull()
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(drawer).toHaveAttribute('inert')
  })
})

describe('public header mobile menu', () => {
  it('exposes the menu state and offers a login action to signed-out visitors', () => {
    render(<Header />)

    const trigger = screen.getByRole('button', { name: 'Open menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'public-mobile-menu')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = document.getElementById('public-mobile-menu')
    expect(menu).not.toBeNull()

    fireEvent.click(within(menu).getByRole('button', { name: 'Login' }))
    expect(router.navigate).toHaveBeenCalledWith('/login')
  })
})
