// Template discovery is bounded and keyset-paged across two collections.
//
// The union of published templates and published projects used to be read in
// full and permission-checked one project at a time, so the response and the
// query count grew with the catalogue. These tests pin the page contract:
// bounded size, no duplicates and no gaps across page boundaries, deterministic
// ordering, and no visibility for a project the viewer cannot read.
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import Template from '../../models/template.js'

const range = (count, offset = 0) => Array.from({ length: count }, (_, index) => offset + index)

const seedTemplates = async (creatorId, creatorName, count, { start = 0, at = null, published = true } = {}) => {
  const base = at ? at.getTime() : Date.now() - 1_000_000
  await Template.collection.insertMany(range(count, start).map((index) => ({
    _id: new mongoose.Types.ObjectId(),
    title: `Template ${index}`,
    category: 'Product',
    creatorId,
    creatorName,
    description: `Description ${index}`,
    images: [],
    isPublished: published,
    isEditable: true,
    favourites: [],
    publishDetails: {},
    // Descending timestamps so later-created rows sort first, as createdAt desc
    // requires. The id is the tie-breaker for equal timestamps.
    createdAt: at || new Date(base + index * 1000),
    updatedAt: at || new Date(base + index * 1000)
  })))
}

const seedProjects = async (creatorId, workspaceId, count, { start = 0, at = null } = {}) => {
  const base = at ? at.getTime() : Date.now() - 900_000
  const docs = range(count, start).map((index) => ({
    _id: new mongoose.Types.ObjectId(),
    name: `Project ${index}`,
    title: `Project ${index}`,
    creatorId,
    workspace: workspaceId,
    members: [creatorId],
    membershipVersion: 0,
    isPublished: true,
    isEditable: true,
    status: true,
    archivedAt: null,
    createdAt: at || new Date(base + index * 1000),
    updatedAt: at || new Date(base + index * 1000)
  }))
  await projectModel.collection.insertMany(docs)
  return docs
}

const page = (api, token, { cursor, limit } = {}) => {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit !== undefined) params.set('limit', String(limit))
  const query = params.toString()
  return api.request('GET', `/api/templates${query ? `?${query}` : ''}`, undefined, token)
}

const collectAll = async (api, token, limit) => {
  const seen = []
  let cursor = null
  let pages = 0
  for (;;) {
    const response = await page(api, token, { cursor, limit })
    assert.equal(response.status, 200)
    seen.push(...response.data.payload)
    pages += 1
    assert.ok(pages <= 30, 'pagination must terminate')
    if (!response.data.page.hasMore) {
      assert.equal(response.data.page.nextCursor, null)
      break
    }
    cursor = response.data.page.nextCursor
  }
  return { seen, pages }
}

test('a page is bounded and the whole catalogue is reachable without duplicates', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'discover@test.invalid', password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({ name: 'Discovery', owner: owner._id, members: [] })
  await seedTemplates(owner._id, owner.name, 70)
  await seedProjects(owner._id, workspace._id, 45)
  const token = await api.tokenFor(owner)

  const first = await page(api, token, { limit: 24 })
  assert.equal(first.status, 200)
  assert.ok(first.data.payload.length <= 24, 'a page must respect the requested bound')
  assert.equal(first.data.page.hasMore, true)
  assert.equal(typeof first.data.page.nextCursor, 'string')

  const { seen, pages } = await collectAll(api, token, 24)
  const ids = seen.map((item) => String(item._id))
  assert.equal(ids.length, 115, 'every published resource is reachable')
  assert.equal(new Set(ids).size, ids.length, 'no row may be repeated across pages')
  assert.ok(pages >= 5)
})

test('ordering is deterministic and equal timestamps use the id tie-breaker', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'order@test.invalid', password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({ name: 'Order', owner: owner._id, members: [] })
  const sameInstant = new Date('2026-01-01T00:00:00.000Z')
  await seedTemplates(owner._id, owner.name, 5, { at: sameInstant })
  await seedProjects(owner._id, workspace._id, 5, { at: sameInstant })
  const token = await api.tokenFor(owner)

  const first = await collectAll(api, token, 3)
  const again = await collectAll(api, token, 3)
  assert.deepEqual(first.seen.map((item) => String(item._id)), again.seen.map((item) => String(item._id)))

  const times = first.seen.map((item) => new Date(item.createdAt).getTime())
  assert.deepEqual(times, [...times].sort((left, right) => right - left), 'newest first')
  const tiedIds = first.seen.filter((item) => new Date(item.createdAt).getTime() === sameInstant.getTime())
    .map((item) => String(item._id))
  assert.deepEqual(tiedIds, [...tiedIds].sort().reverse(), 'equal timestamps fall back to descending id')
})

test('a row inserted between pages does not hide an older row or repeat a seen one', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'shift@test.invalid', password: 'synthetic-password' })
  await seedTemplates(owner._id, owner.name, 30)
  const token = await api.tokenFor(owner)

  const first = await page(api, token, { limit: 10 })
  assert.equal(first.status, 200)
  const seenIds = new Set(first.data.payload.map((item) => String(item._id)))
  assert.equal(seenIds.size, 10)

  // A new, newest row arrives after page one was read.
  await seedTemplates(owner._id, owner.name, 1, { start: 900, at: new Date() })

  const second = await page(api, token, { cursor: first.data.page.nextCursor, limit: 10 })
  assert.equal(second.status, 200)
  assert.equal(second.data.payload.some((item) => seenIds.has(String(item._id))), false)
  // The new row sorts before the cursor, so it is not silently injected into
  // page two; the page continues exactly after the last seen key.
  assert.equal(second.data.payload.some((item) => item.title === 'Template 900'), false)
})

test('a deleted row between pages does not shift the page boundary', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'delete@test.invalid', password: 'synthetic-password' })
  await seedTemplates(owner._id, owner.name, 25)
  const token = await api.tokenFor(owner)

  const first = await page(api, token, { limit: 10 })
  const seenIds = new Set(first.data.payload.map((item) => String(item._id)))
  // Delete a row the client already saw; the rest of the catalogue is intact.
  await Template.deleteOne({ _id: first.data.payload[0]._id })

  const second = await page(api, token, { cursor: first.data.page.nextCursor, limit: 10 })
  assert.equal(second.data.payload.some((item) => seenIds.has(String(item._id))), false)
  assert.equal(second.data.payload.length, 10)
})

test('a published project whose creator lost access stays hidden on every page', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'hidden-owner@test.invalid', password: 'synthetic-password' })
  const stranger = await UserModel.create({ name: 'Stranger', email: 'hidden-stranger@test.invalid', password: 'synthetic-password' })
  const viewer = await UserModel.create({ name: 'Viewer', email: 'hidden-viewer@test.invalid', password: 'synthetic-password' })
  await WorkspaceModel.create({ name: 'Shared', owner: owner._id, members: [{ user: viewer._id, role: 'MEMBER' }] })
  const lostWorkspace = await WorkspaceModel.create({ name: 'Elsewhere', owner: owner._id, members: [{ user: stranger._id, role: 'MEMBER' }] })
  await seedTemplates(owner._id, owner.name, 6)
  await seedProjects(stranger._id, lostWorkspace._id, 6)
  // Publication cannot outlive the creator's own access to the board.
  await WorkspaceModel.updateOne({ _id: lostWorkspace._id }, { $pull: { members: { user: stranger._id } } })
  const token = await api.tokenFor(viewer)

  const { seen } = await collectAll(api, token, 4)
  assert.equal(seen.some((item) => item.title.startsWith('Project ')), false)
  assert.equal(seen.length, 6)
  assert.ok(seen.every((item) => item.type === 'template'))
})

test('an unpublished template owned by someone else never appears on any page', async (t) => {
  const api = await testApi(t)
  const stranger = await UserModel.create({ name: 'Stranger', email: 'private-owner@test.invalid', password: 'synthetic-password' })
  const viewer = await UserModel.create({ name: 'Viewer', email: 'private-viewer@test.invalid', password: 'synthetic-password' })
  // Six visible templates, then three private ones that sort after them. The
  // visibility predicate must survive the cursor on every page, not just the
  // first one.
  await seedTemplates(stranger._id, stranger.name, 6)
  await seedTemplates(stranger._id, stranger.name, 3, {
    start: 400, published: false, at: new Date(Date.now() - 9_000_000)
  })
  const token = await api.tokenFor(viewer)

  const { seen, pages } = await collectAll(api, token, 2)
  assert.ok(pages >= 3)
  assert.equal(seen.some((item) => item.title === 'Template 400'), false)
  assert.equal(seen.some((item) => item.title === 'Template 401'), false)
  assert.equal(seen.some((item) => item.title === 'Template 402'), false)
  assert.equal(seen.length, 6, 'only the published templates are reachable')
})

test('search reaches the whole catalogue, not only the first page', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'search@test.invalid', password: 'synthetic-password' })
  await seedTemplates(owner._id, owner.name, 40)
  // The only row with this word is older than the first page.
  await Template.collection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    title: 'Incident retro checklist', category: 'Operations', creatorId: owner._id,
    creatorName: owner.name, description: 'special: postmortem', images: [],
    isPublished: true, isEditable: true, favourites: [], publishDetails: {},
    createdAt: new Date(Date.now() - 9_000_000), updatedAt: new Date(Date.now() - 9_000_000)
  })
  const token = await api.tokenFor(owner)

  const found = await api.request('GET', '/api/templates?search=INCIDE&limit=8', undefined, token)
  assert.equal(found.status, 200)
  assert.deepEqual(found.data.payload.map((item) => item.title), ['Incident retro checklist'])
  assert.equal(found.data.page.hasMore, false)

  const byDescription = await api.request('GET', '/api/templates?search=postmortem', undefined, token)
  assert.equal(byDescription.data.payload.length, 1)

  // Metacharacters are matched literally instead of becoming a wildcard.
  const wildcard = await api.request('GET', '/api/templates?search=.*', undefined, token)
  assert.equal(wildcard.status, 200)
  assert.equal(wildcard.data.payload.length, 0)

  const tooLong = await api.request('GET', `/api/templates?search=${'x'.repeat(81)}`, undefined, token)
  assert.equal(tooLong.status, 400)

  const empty = await api.request('GET', '/api/templates?search=no-such-template', undefined, token)
  assert.equal(empty.data.payload.length, 0)
  assert.equal(empty.data.page.hasMore, false)
})

test('search never returns another account\'s unpublished template', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'search-owner@test.invalid', password: 'synthetic-password' })
  const viewer = await UserModel.create({ name: 'Viewer', email: 'search-viewer@test.invalid', password: 'synthetic-password' })
  await seedTemplates(owner._id, owner.name, 3, { published: false })
  const token = await api.tokenFor(viewer)

  const response = await api.request('GET', '/api/templates?search=Template', undefined, token)
  assert.equal(response.status, 200)
  assert.equal(response.data.payload.length, 0)
})

test('favourites are resolved for the page and an invalid cursor is refused', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'fav@test.invalid', password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({ name: 'Favourites', owner: owner._id, members: [] })
  const projects = await seedProjects(owner._id, workspace._id, 4)
  await Template.collection.insertOne({
    _id: new mongoose.Types.ObjectId(), type: 'fav-marker', projectRef: projects[0]._id,
    favourites: [owner._id], creatorId: owner._id, title: '', category: '', creatorName: ''
  })
  const token = await api.tokenFor(owner)

  const response = await page(api, token, { limit: 10 })
  const favourited = response.data.payload.find((item) => String(item._id) === String(projects[0]._id))
  assert.equal(favourited.favourite, true)
  assert.equal(response.data.payload.filter((item) => item.favourite).length, 1)

  const bad = await page(api, token, { cursor: 'not-a-cursor' })
  assert.equal(bad.status, 400)
  const tooLarge = await page(api, token, { limit: 500 })
  assert.equal(tooLarge.status, 400)
  const tooSmall = await page(api, token, { limit: 0 })
  assert.equal(tooSmall.status, 400)
})

test('one page costs a bounded number of workspace lookups', async (t) => {
  const api = await testApi(t)
  const owner = await UserModel.create({ name: 'Owner', email: 'count@test.invalid', password: 'synthetic-password' })
  const workspace = await WorkspaceModel.create({ name: 'Counting', owner: owner._id, members: [] })
  await seedProjects(owner._id, workspace._id, 40)
  const token = await api.tokenFor(owner)

  const findById = WorkspaceModel.findById
  const find = WorkspaceModel.find
  let single = 0
  let batched = 0
  WorkspaceModel.findById = function countingFindById(...args) { single += 1; return findById.apply(this, args) }
  WorkspaceModel.find = function countingFind(...args) { batched += 1; return find.apply(this, args) }
  t.after(() => { WorkspaceModel.findById = findById; WorkspaceModel.find = find })

  const response = await page(api, token, { limit: 24 })
  assert.equal(response.status, 200)
  assert.ok(response.data.payload.length <= 24)
  // The page's projects all share one workspace, so capabilities are resolved
  // from the batched read instead of a query per project.
  assert.equal(single, 0, 'no per-project workspace lookup')
  assert.ok(batched <= 2, `bounded workspace reads, saw ${batched}`)
})
