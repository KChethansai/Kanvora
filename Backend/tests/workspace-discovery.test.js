import test from 'node:test'
import assert from 'node:assert/strict'
import { collectAccessibleWorkspaces } from '../controllers/workspaceDiscovery.js'

const userId = 'user-1'
const row = (_id, accessible, updatedAt) => ({ _id, accessible, updatedAt })

// Fake model: serves a scripted sequence of pages through the same
// find().sort().limit().maxTimeMS() chain Mongoose exposes.
const createFakeModel = (pages) => {
  const queries = []
  const limits = []
  let rowsReturned = 0
  const find = (query) => {
    queries.push(structuredClone(query))
    const pageIndex = queries.length - 1
    let limit = Number.POSITIVE_INFINITY
    const chain = {
      sort() { return chain },
      limit(value) { limit = value; limits.push(value); return chain },
      async maxTimeMS() {
        const page = pages[pageIndex] || []
        const rows = page.slice(0, limit)
        rowsReturned += rows.length
        return rows
      }
    }
    return chain
  }
  return { find, queries, limits, rowsReturned: () => rowsReturned }
}

const readableOnly = (workspace) => workspace.accessible === true

test('a readable workspace found after more than a thousand rejected candidates is returned', async () => {
  const pages = []
  for (let page = 0; page < 5; page += 1) {
    pages.push(Array.from({ length: 200 }, (_, index) => row(`rejected-${page}-${index}`, false)))
  }
  pages.push([row('target', true)])
  const model = createFakeModel(pages)

  const found = await collectAccessibleWorkspaces({
    find: model.find,
    canRead: readableOnly,
    userId
  })

  assert.equal(pages.flat().filter((workspace) => !workspace.accessible).length, 1000)
  assert.equal(found.length, 1)
  assert.equal(found[0]._id, 'target')
  assert.equal(model.queries.length, 6)
})

test('the scan never exceeds maxScan rows', async () => {
  const page = Array.from({ length: 200 }, (_, index) => row(`row-${index}`, false))
  const model = createFakeModel([page, page, page, page])

  const found = await collectAccessibleWorkspaces({
    find: model.find,
    canRead: readableOnly,
    userId,
    maxScan: 500
  })

  assert.equal(found.length, 0)
  assert.equal(model.rowsReturned(), 500)
  assert.equal(model.queries.length, 3)
  assert.deepEqual(model.limits, [200, 200, 100])
  assert.equal(model.limits.reduce((total, value) => total + value, 0), 500)
})

test('the scan stops once the requested number of accessible workspaces is collected', async () => {
  const model = createFakeModel([
    Array.from({ length: 10 }, (_, index) => row(`first-${index}`, true)),
    Array.from({ length: 10 }, (_, index) => row(`second-${index}`, true))
  ])

  const found = await collectAccessibleWorkspaces({
    find: model.find,
    canRead: readableOnly,
    userId,
    limit: 3
  })

  assert.equal(found.length, 3)
  assert.deepEqual(found.map((workspace) => workspace._id), ['first-0', 'first-1', 'first-2'])
  assert.equal(model.queries.length, 1)
})

test('pagination filters on a composite (updatedAt, _id) cursor and keeps the previous order', async () => {
  const model = createFakeModel([
    [row('a', true, '2026-01-03T00:00:00.000Z'), row('b', true, '2026-01-02T00:00:00.000Z')],
    [row('c', true, '2026-01-02T00:00:00.000Z'), row('d', true, '2026-01-01T00:00:00.000Z')],
    [row('e', true, '2025-12-31T00:00:00.000Z'), row('f', true, '2025-12-30T00:00:00.000Z')]
  ])

  const found = await collectAccessibleWorkspaces({
    find: model.find,
    canRead: readableOnly,
    userId,
    pageSize: 2
  })

  assert.equal(found.length, 6)
  assert.equal(model.queries.length, 4)
  assert.equal(model.queries[0].$and, undefined)
  assert.deepEqual(model.queries[1].$and, [{
    $or: [
      { updatedAt: { $lt: '2026-01-02T00:00:00.000Z' } },
      { updatedAt: '2026-01-02T00:00:00.000Z', _id: { $lt: 'b' } }
    ]
  }])
  assert.deepEqual(model.queries[2].$and, [{
    $or: [
      { updatedAt: { $lt: '2026-01-01T00:00:00.000Z' } },
      { updatedAt: '2026-01-01T00:00:00.000Z', _id: { $lt: 'd' } }
    ]
  }])
  assert.deepEqual(model.queries[3].$and, [{
    $or: [
      { updatedAt: { $lt: '2025-12-30T00:00:00.000Z' } },
      { updatedAt: '2025-12-30T00:00:00.000Z', _id: { $lt: 'f' } }
    ]
  }])
  // The order stays "most recently updated first", as it was before paging.
  assert.deepEqual(found.map((workspace) => workspace._id), ['a', 'b', 'c', 'd', 'e', 'f'])
  assert.equal(model.queries[0].$or.length, 2)
})
