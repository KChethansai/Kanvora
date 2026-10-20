import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import Project from '../components/Project'
import { useProjectStore as board } from '../store/projectStore'

const dnd = vi.hoisted(() => ({ props: null }))
const socket = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props) => { dnd.props = props; return props.children },
  DragOverlay: () => null, PointerSensor: vi.fn(), useSensor: vi.fn(), useSensors: vi.fn(), closestCorners: vi.fn()
}))
vi.mock('@dnd-kit/sortable', async (original) => ({ ...await original(), SortableContext: ({ children }) => children }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ projectId: 'p' }), useNavigate: () => vi.fn() }))
vi.mock('../components/ListColumn', () => ({ ListColumn: () => null, AddListForm: () => null }))
vi.mock('../components/Card', () => ({ DragCard: () => null }))
vi.mock('../components/CardDetailModal', () => ({ default: () => null }))
vi.mock('../components/PublishForm', () => ({ default: () => null }))
vi.mock('socket.io-client', () => ({ io: () => socket }))
vi.mock('axios', () => ({ default: { defaults: {}, get: vi.fn(), put: vi.fn() } }))

const card = (id, listId, order) => ({ _id: id, listId, order, title: id, labels: [] })
const target = (cardId, listId) => ({ id: cardId, data: { current: { type: 'card', cardId, listId } } })
let storedCards
const broadcast = (event, data) => socket.on.mock.calls.find(([name]) => name === event)?.[1](data)
beforeEach(() => {
  vi.clearAllMocks()
  storedCards = { todo: [], done: [] }
  board.getState().resetProjects()
  board.getState().resetBoard()
  const lists = [{ _id: 'todo', projectId: 'p', title: 'To Do', order: 0 }, { _id: 'done', projectId: 'p', title: 'Done', order: 1 }]
  axios.get.mockImplementation(async (url) => ({ data: { payload: url.endsWith('/lists') ? lists : url.endsWith('/cards') ? structuredClone(storedCards[url.match(/lists\/([^/]+)\/cards/)[1]]) : { _id: 'p', title: 'Board' } } }))
  axios.put.mockImplementation(async (url, data) => {
    if (url.endsWith('/cards/reorder')) {
      const listId = url.match(/lists\/([^/]+)\/cards/)[1]
      storedCards[listId] = data.orderedIds.map((id, order) => ({ ...storedCards[listId].find((item) => item._id === id), order }))
      broadcast('cards-reordered', { listId, orderedIds: data.orderedIds })
      return { data: { payload: structuredClone(storedCards[listId]) } }
    }
    const id = url.split('/').at(-1)
    const source = Object.keys(storedCards).find((listId) => storedCards[listId].some((item) => item._id === id))
    const existing = storedCards[source].find((item) => item._id === id)
    const destination = data.listId || source
    // Mirror ProjectsAPI: order is valid only on a cross-list move. A same-list
    // status PUT must retain the order already committed by the reorder endpoint.
    if (destination === source && Object.hasOwn(data, 'order')) {
      throw { response: { status: 400, data: { message: 'Use the reorder endpoint' } } }
    }
    const updated = { ...existing, ...data }
    if (source !== destination) {
      storedCards[source] = storedCards[source].filter((item) => item._id !== id).map((item, order) => ({ ...item, order }))
      storedCards[destination] = [...storedCards[destination].slice(0, data.order), updated, ...storedCards[destination].slice(data.order)].map((item, order) => ({ ...item, order }))
    } else {
      storedCards[source] = storedCards[source].map((item) => item._id === id ? updated : item)
    }
    broadcast('card-updated', structuredClone(updated))
    return { data: { payload: structuredClone(updated) } }
  })
})
afterEach(cleanup)

it.each([false, true])('actual drag -> status update -> persistence retains exact drop position (cross-list=%s)', async (crossList) => {
  render(<Project />)
  await waitFor(() => {
    expect(board.getState().activeProject?._id).toBe('p')
    expect(Object.keys(board.getState().cards)).toHaveLength(2)
  })
  await act(async () => {
    storedCards = { todo: [card('a', 'todo', 0), card('b', 'todo', 1), card('c', 'todo', 2)], done: [card('x', 'done', 0), card('y', 'done', 1)] }
    board.setState({ cards: structuredClone(storedCards) })
  })
  const active = target('c', 'todo')
  const destination = crossList ? 'done' : 'todo'
  const over = target(crossList ? 'y' : 'b', destination)
  act(() => dnd.props.onDragStart({ active }))
  act(() => dnd.props.onDragOver({ active, over }))
  await act(async () => { await dnd.props.onDragEnd({ active, over }) })
  const expected = crossList ? ['x', 'c', 'y'] : ['a', 'c', 'b']
  expect(board.getState().cards[destination].map((item) => item._id)).toEqual(expected)
  const statusCall = axios.put.mock.calls.find(([url]) => url.endsWith('/cards/c'))
  if (crossList) {
    expect(statusCall[1]).toMatchObject({ listId: 'done', order: 1, status: 'DONE' })
  } else {
    expect(statusCall[1]).not.toHaveProperty('order')
    expect(axios.put.mock.calls.findIndex(([url]) => url.endsWith('/todo/cards/reorder'))).toBeLessThan(axios.put.mock.calls.indexOf(statusCall))
  }
  expect(axios.put.mock.calls.filter(([url]) => url.endsWith(`/${destination}/cards/reorder`)).at(-1)?.[1]).toEqual({ orderedIds: expected })
  expect(storedCards[destination].map((item) => item._id)).toEqual(expected)
  expect(storedCards[destination].find((item) => item._id === 'c').status).toBe(crossList ? 'DONE' : 'TO-DO')
  await act(async () => { await board.getState().fetchCards(destination) })
  act(() => {
    // Out-of-order realtime delivery must not resurrect pre-drag positions.
    for (const item of [...storedCards[destination]].reverse()) broadcast('card-updated', structuredClone(item))
  })
  expect(board.getState().cards[destination].map((item) => item._id)).toEqual(expected)
  expect(board.getState().cards[destination].map((item) => item.order)).toEqual([0, 1, 2])
})
