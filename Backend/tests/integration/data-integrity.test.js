import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'

async function fixture(t) {
  const api = await testApi(t)
  const owner = await UserModel.create({
    name: 'Owner', email: 'integrity@example.test', password: 'synthetic-password', role: 'MEMBER'
  })
  const project = await projectModel.create({ name: 'Integrity', creatorId: owner._id })
  return { api, owner, token: await api.tokenFor(owner), project }
}

const list = (api, project, title, token) =>
  api.request('POST', `/projects-api/projects/${project.id}/lists`, { title }, token)
const card = (api, listId, title, token) =>
  api.request('POST', `/projects-api/lists/${listId}/cards`, { title }, token)

test('concurrent list and card creation allocate unique server-owned orders', async (t) => {
  const { api, token, project } = await fixture(t)

  const lists = await Promise.all(Array.from({ length: 12 }, (_, index) => list(api, project, `List ${index}`, token)))
  assert.deepEqual(lists.map((result) => result.status), Array(12).fill(201))
  assert.deepEqual(lists.map((result) => result.data.payload.order).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index))

  const target = lists[0].data.payload
  const cards = await Promise.all(Array.from({ length: 12 }, (_, index) => card(api, target._id, `Card ${index}`, token)))
  assert.deepEqual(cards.map((result) => result.status), Array(12).fill(201))
  assert.deepEqual(cards.map((result) => result.data.payload.order).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index))
})

test('order counters seed from legacy rows that predate sequence fields', async (t) => {
  const { api, owner, token, project } = await fixture(t)
  assert.equal(project.listSequence, -1)
  const existingList = await ListModel.create({ title: 'Legacy list', projectId: project._id, order: 5 })
  const createdList = await list(api, project, 'After legacy', token)
  assert.equal(createdList.status, 201)
  assert.equal(createdList.data.payload.order, 6)

  await taskModel.create({
    title: 'Legacy card', listId: existingList._id, projectId: project._id, creatorId: owner._id, order: 5
  })
  const createdCard = await card(api, existingList._id, 'After legacy card', token)
  assert.equal(createdCard.status, 201)
  assert.equal(createdCard.data.payload.order, 6)
})

test('list and card reorders are complete and do not partially apply invalid payloads', async (t) => {
  const { api, token, project } = await fixture(t)
  const created = []
  for (const title of ['A', 'B', 'C']) created.push((await list(api, project, title, token)).data.payload)
  const [a, b, c] = created

  const invalid = await api.request('PUT', `/projects-api/projects/${project.id}/lists/reorder`, {
    orderedIds: [a._id, b._id, String(project._id)]
  }, token)
  assert.equal(invalid.status, 400)
  const afterInvalid = await ListModel.find({ projectId: project._id }).sort({ order: 1 })
  assert.deepEqual(afterInvalid.map((item) => String(item._id)), [a._id, b._id, c._id])

  const subset = await api.request('PUT', `/projects-api/projects/${project.id}/lists/reorder`, {
    orderedIds: [a._id, b._id]
  }, token)
  assert.equal(subset.status, 400)
  const afterSubset = await ListModel.find({ projectId: project._id }).sort({ order: 1 })
  assert.deepEqual(afterSubset.map((item) => String(item._id)), [a._id, b._id, c._id])

  const [first, second] = await Promise.all([
    api.request('PUT', `/projects-api/projects/${project.id}/lists/reorder`, {
      orderedIds: [c._id, b._id, a._id]
    }, token),
    api.request('PUT', `/projects-api/projects/${project.id}/lists/reorder`, {
      orderedIds: [a._id, c._id, b._id]
    }, token)
  ])
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  const finalLists = await ListModel.find({ projectId: project._id }).sort({ order: 1 })
  assert.deepEqual(finalLists.map((item) => item.order), [0, 1, 2])
  assert.deepEqual(new Set(finalLists.map((item) => String(item._id))),
    new Set([a._id, b._id, c._id]))

  const cardA = (await card(api, a._id, 'Card A', token)).data.payload
  const cardB = (await card(api, a._id, 'Card B', token)).data.payload
  assert.equal((await api.request('PUT', `/projects-api/lists/${a._id}/cards/reorder`, {
    orderedIds: [cardB._id, cardA._id]
  }, token)).status, 200)
  const orderedCards = await taskModel.find({ listId: a._id }).sort({ order: 1 })
  assert.deepEqual(orderedCards.map((item) => String(item._id)), [cardB._id, cardA._id])
})

test('deleting a list removes its cards atomically and leaves sibling lists intact', async (t) => {
  const { api, token, project } = await fixture(t)
  const doomed = (await list(api, project, 'Doomed', token)).data.payload
  const survivor = (await list(api, project, 'Survivor', token)).data.payload
  const doomedCard = (await card(api, doomed._id, 'Doomed card', token)).data.payload
  const survivorCard = (await card(api, survivor._id, 'Survivor card', token)).data.payload

  assert.equal((await api.request('DELETE', `/projects-api/lists/${doomed._id}`, undefined, token)).status, 200)
  assert.equal(await ListModel.exists({ _id: doomed._id }), null)
  assert.equal(await taskModel.exists({ _id: doomedCard._id }), null)
  assert.ok(await ListModel.exists({ _id: survivor._id }))
  assert.ok(await taskModel.exists({ _id: survivorCard._id }))
})

test('moving a card makes room in the target list and appends when no position is given', async (t) => {
  const { api, token, project } = await fixture(t)
  const source = (await list(api, project, 'Source', token)).data.payload
  const target = (await list(api, project, 'Target', token)).data.payload
  const moving = (await card(api, source._id, 'Moving', token)).data.payload
  const first = (await card(api, target._id, 'First', token)).data.payload
  const second = (await card(api, target._id, 'Second', token)).data.payload

  const moved = await api.request('PUT', `/projects-api/cards/${moving._id}`, {
    listId: target._id, order: 1, status: null
  }, token)
  assert.equal(moved.status, 200)
  assert.equal(moved.data.payload.listId, target._id)
  assert.equal(moved.data.payload.order, 1)
  assert.equal(moved.data.payload.status, null)
  const targetOrder = await taskModel.find({ listId: target._id, isActive: true }).sort({ order: 1 })
  assert.deepEqual(targetOrder.map((item) => Number(item.order)), [0, 1, 2])
  assert.deepEqual(targetOrder.map((item) => String(item._id)), [first._id, moving._id, second._id])

  const appended = (await card(api, source._id, 'Appended', token)).data.payload
  const appendedResult = await api.request('PUT', `/projects-api/cards/${appended._id}`, {
    listId: target._id
  }, token)
  assert.equal(appendedResult.status, 200)
  assert.equal(appendedResult.data.payload.order, 3)

  const reorderAttempt = await api.request('PUT', `/projects-api/cards/${moving._id}`, { order: 0 }, token)
  assert.equal(reorderAttempt.status, 400)
})
