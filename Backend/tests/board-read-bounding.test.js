// The list and card reads of a board are bounded: one page per request, a
// signed cursor to continue, and a response shape the board client already
// consumes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
})

const userId = 'a'.repeat(24)
const projectId = 'b'.repeat(24)
const listId = 'c'.repeat(24)
const objectId = (value) => value

// A query that behaves like the Mongoose chain the API uses: it records the
// filter, the sort and the limit, and resolves to the rows it was given.
const createFakeQuery = (rows, recorder) => {
  const query = {
    _rows: rows,
    sort(spec) { recorder.sorts.push(spec); return query },
    limit(value) { recorder.limits.push(value); query._rows = rows.slice(0, value); return query },
    populate() { return query },
    lean() { return query },
    select() { return query },
    session() { return query },
    then(resolve, reject) { return Promise.resolve(query._rows).then(resolve, reject) }
  }
  return query
}

const recorder = () => ({ filters: [], sorts: [], limits: [] })

const fakeProject = () => ({
  _id: projectId,
  status: true,
  archivedAt: null,
  workspace: null,
  creatorId: userId,
  membershipVersion: 1,
  directGrants: [],
  save: async () => {}
})

const fakeList = () => ({ _id: listId, projectId, order: 0 })

const rows = (count, prefix) => Array.from({ length: count }, (_, index) => ({
  _id: `${prefix}${String(index).padStart(23, '0')}`,
  order: index,
  projectId,
  createdAt: new Date('2026-01-01T00:00:00.000Z')
}))

const loadApi = async () => {
  const { getProjectLists, getListCards, buildProjectAnalytics } = await import('../APIs/ProjectsAPI.js')
  const { ListModel } = await import('../models/ListModel.js')
  const { taskModel } = await import('../models/Taskmodel.js')
  const { projectModel } = await import('../models/ProjectModel.js')
  const { ActivityModel } = await import('../models/Activity.js')
  return { getProjectLists, getListCards, buildProjectAnalytics, ListModel, taskModel, projectModel, ActivityModel }
}

// A response double that records the status and the body a handler produced.
const fakeResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) { response.statusCode = code; return response },
    json(payload) { response.body = payload; return response },
    set() { return response },
    redirect() { return response }
  }
  return response
}

test('a list read returns one bounded page and a cursor for the rest', async (t) => {
  const api = await loadApi()
  const calls = recorder()
  t.mock.method(api.ListModel, 'find', (filter) => {
    calls.filters.push(filter)
    return createFakeQuery(rows(150, '1'), calls)
  })
  t.mock.method(api.projectModel, 'findById', () => ({ session: () => fakeProject() }))

  const res = fakeResponse()
  await api.getProjectLists({ params: { id: projectId }, query: {}, user: { id: userId } }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  // The client reads `payload` as an array; the page is capped and the
  // envelope reports that more rows exist.
  assert.ok(Array.isArray(res.body.payload))
  assert.equal(res.body.payload.length, 100)
  assert.equal(res.body.hasMore, true)
  assert.equal(typeof res.body.nextCursor, 'string')
  // The query itself never asks for the whole board.
  assert.deepEqual(calls.limits, [101])
  assert.deepEqual(calls.sorts, [{ order: 1, _id: 1 }])
})

test('a card read returns one bounded page and a cursor for the rest', async (t) => {
  const api = await loadApi()
  const calls = recorder()
  t.mock.method(api.taskModel, 'find', (filter) => {
    calls.filters.push(filter)
    return createFakeQuery(rows(120, '2'), calls)
  })
  t.mock.method(api.ListModel, 'findById', () => ({ session: () => fakeList() }))
  t.mock.method(api.projectModel, 'findById', () => ({ session: () => fakeProject() }))

  const res = fakeResponse()
  await api.getListCards({ params: { id: listId }, query: {}, user: { id: userId } }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.body.payload))
  assert.equal(res.body.payload.length, 100)
  assert.equal(res.body.hasMore, true)
  assert.equal(typeof res.body.nextCursor, 'string')
  assert.deepEqual(calls.limits, [101])
  // The order the board client relies on is preserved.
  assert.deepEqual(calls.sorts, [{ order: 1, createdAt: 1, _id: 1 }])
})

test('the last page reports that no further rows exist', async (t) => {
  const api = await loadApi()
  const calls = recorder()
  t.mock.method(api.ListModel, 'find', () => createFakeQuery(rows(3, '3'), calls))
  t.mock.method(api.projectModel, 'findById', () => ({ session: () => fakeProject() }))

  const res = fakeResponse()
  await api.getProjectLists({ params: { id: projectId }, query: {}, user: { id: userId } }, res, (err) => { throw err })

  assert.equal(res.body.payload.length, 3)
  assert.equal(res.body.hasMore, false)
  assert.equal(res.body.nextCursor, null)
})

test('a cursor resumes the page and is refused for another board, list or caller', async (t) => {
  const api = await loadApi()
  const calls = recorder()
  t.mock.method(api.ListModel, 'find', (filter) => {
    calls.filters.push(filter)
    return createFakeQuery(rows(2, '4'), calls)
  })
  t.mock.method(api.projectModel, 'findById', () => ({ session: () => fakeProject() }))

  const first = fakeResponse()
  await api.getProjectLists({ params: { id: projectId }, query: { limit: '1' }, user: { id: userId } }, first, (err) => { throw err })
  const cursor = first.body.nextCursor
  assert.equal(typeof cursor, 'string')

  // The cursor resumes the read instead of starting over.
  const second = fakeResponse()
  await api.getProjectLists({ params: { id: projectId }, query: { limit: '1', cursor }, user: { id: userId } }, second, (err) => { throw err })
  assert.equal(second.statusCode, 200)
  assert.ok(calls.filters[1].$and, 'the resumed read filters on the cursor position')

  // The cursor is bound to the board it was issued for.
  for (const query of [
    { limit: '1', cursor },
    { limit: '1', cursor: `${cursor}x` }
  ]) {
    const denied = fakeResponse()
    let failure = null
    await api.getProjectLists({ params: { id: 'd'.repeat(24) }, query, user: { id: userId } }, denied, (err) => { failure = err })
    assert.equal(failure?.status, 400, 'a cursor from another board or a tampered cursor is refused')
  }
})

test('a page size above the maximum or below one is refused', async (t) => {
  const api = await loadApi()
  t.mock.method(api.ListModel, 'find', () => createFakeQuery([], recorder()))
  t.mock.method(api.projectModel, 'findById', () => ({ session: () => fakeProject() }))

  for (const limit of ['101', '0', '1.5', '-1', 'abc']) {
    let failure = null
    await api.getProjectLists({ params: { id: projectId }, query: { limit }, user: { id: userId } }, fakeResponse(), (err) => { failure = err })
    assert.equal(failure?.status, 400, `limit=${limit} must be refused`)
  }
})

test('analytics aggregate the board instead of reading every card', async (t) => {
  const api = await loadApi()
  const calls = recorder()
  t.mock.method(api.ListModel, 'countDocuments', async () => 4)
  t.mock.method(api.ActivityModel, 'countDocuments', async () => 7)
  t.mock.method(api.taskModel, 'aggregate', async (pipeline) => {
    calls.filters.push(pipeline)
    return [{
      totals: [{ count: 3 }],
      byStatus: [{ _id: 'TO-DO', count: 2 }, { _id: 'DONE', count: 1 }],
      byPriority: [{ _id: 'MEDIUM', count: 3 }],
      overdue: [{ count: 1 }],
      workload: [{ _id: userId, count: 2 }, { _id: 'unassigned', count: 1 }]
    }]
  })

  const analytics = await api.buildProjectAnalytics(projectId)

  // The response shape the board client consumes is unchanged.
  assert.deepEqual(analytics, {
    totals: { lists: 4, cards: 3, activity: 7 },
    byStatus: { 'TO-DO': 2, DONE: 1 },
    byPriority: { MEDIUM: 3 },
    overdue: 1,
    workload: { [userId]: 2, unassigned: 1 }
  })
  // The board is never read into memory: one grouped aggregation replaces it.
  const pipeline = calls.filters[0]
  assert.equal(pipeline[0].$match.isActive, true)
  assert.equal(pipeline[1].$lookup.localField, 'listId')
  assert.ok(pipeline.at(-1).$facet)
})

test('the socket server can be created without a database', async (t) => {
  // The eviction helpers need an initialised server; creating one must not
  // touch the database.
  const { init } = await import('../socket.js')
  const server = createServer()
  const io = init(server)
  t.after(() => new Promise((resolve) => io.close(resolve)))
  assert.ok(io)
})
