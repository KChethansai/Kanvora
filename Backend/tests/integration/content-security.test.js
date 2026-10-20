import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'
import { CommentModel } from '../../models/CommentModel.js'
import { NotificationModel } from '../../models/NotificationModel.js'
import Template from '../../models/template.js'

test('content authorization and safe representations', async (t) => {
  const { request, tokenFor } = await testApi(t)
  const users = await UserModel.create(['owner', 'member', 'viewer', 'outsider'].map((name) => ({
    name, username: name, email: `${name}@example.test`, password: 'synthetic-password', role: name === 'outsider' ? 'ADMIN' : 'MEMBER'
  })))
  const [owner, member, viewer, outsider] = users
  const tokens = await Promise.all(users.map(tokenFor))
  const [own, mem, view, out] = tokens
  const ws = await WorkspaceModel.create({ name: 'Workspace', owner: owner._id, members: [
    { user: member._id, role: 'MEMBER' }, { user: viewer._id, role: 'VIEWER' }
  ] })
  const project = await projectModel.create({ name: 'Private board', workspace: ws._id, creatorId: owner._id, members: [member._id, viewer._id] })
  const list = await ListModel.create({ title: 'List', projectId: project._id })
  const task = await taskModel.create({ title: 'Card', projectId: project._id, listId: list._id, creatorId: owner._id })
  const comment = await CommentModel.create({ task: task._id, author: member._id, body: 'Original' })
  const draft = await Template.create({ title: 'Draft', category: 'Test', creatorId: owner._id, creatorName: 'Owner', isEditable: true, publishDetails: { notes: 'private-note', contactEmail: 'private@example.test' } })
  const published = await Template.create({ title: 'Published', category: 'Test', creatorId: owner._id, creatorName: 'Owner', isPublished: true, favourites: [member._id], publishDetails: { notes: 'private-note', contactEmail: 'private@example.test' } })
  const marker = await Template.create({ title: 'Marker', category: 'system', creatorId: owner._id, creatorName: 'system', type: 'fav-marker', projectRef: project._id })

  await t.test('outsiders cannot read or post comments despite global ADMIN', async () => {
    assert.equal((await request('GET', `/api/comment/${task._id}`, undefined, out)).status, 404)
    assert.equal((await request('POST', '/api/comment', { taskId: String(task._id), body: 'Intrusion' }, out)).status, 404)
  })
  await t.test('viewer reads but cannot post; actor email is not exposed', async () => {
    const result = await request('GET', `/api/comment/${task._id}`, undefined, view)
    assert.equal(result.status, 200)
    assert.equal(result.data.payload[0].author.email, undefined)
    assert.equal((await request('POST', '/api/comment', { taskId: String(task._id), body: 'No' }, view)).status, 404)
  })
  await t.test('only authors rewrite; scoped managers can delete', async () => {
    assert.equal((await request('PUT', `/api/comment/${comment._id}`, { body: 'Rewrite' }, own)).status, 403)
    assert.equal((await request('DELETE', `/api/comment/${comment._id}`, undefined, out)).status, 404)
    assert.equal((await request('PUT', `/api/comment/${comment._id}`, { body: 'Edited' }, mem)).status, 200)
    const moderation = await CommentModel.create({ task: task._id, author: member._id, body: 'Moderate me' })
    assert.equal((await request('DELETE', `/api/comment/${moderation._id}`, undefined, own)).status, 200)
    assert.equal(await CommentModel.findById(moderation._id), null)
  })
  await t.test('comment input and pagination are bounded', async () => {
    for (const body of [{ body: 'x', author: String(owner._id) }, { body: 'x'.repeat(10001) }, { body: {} }]) {
      assert.equal((await request('POST', '/api/comment', { taskId: String(task._id), ...body }, mem)).status, 400)
    }
    assert.equal((await request('GET', '/api/comment/invalid', undefined, mem)).status, 400)
    assert.equal((await request('GET', `/api/comment/${task._id}?limit=1000`, undefined, mem)).status, 400)
    assert.equal((await request('PUT', `/api/comment/${comment._id}`, { body: 'x', author: String(owner._id) }, mem)).status, 400)
    assert.equal((await request('DELETE', '/api/comment/invalid', undefined, own)).status, 400)
  })
  await t.test('invalid task/list and inactive task cannot expose comments', async () => {
    await taskModel.updateOne({ _id: task._id }, { isActive: false })
    assert.equal((await request('GET', `/api/comment/${task._id}`, undefined, own)).status, 404)
    await taskModel.updateOne({ _id: task._id }, { isActive: true, listId: new mongoose.Types.ObjectId() })
    assert.equal((await request('GET', `/api/comment/${task._id}`, undefined, own)).status, 404)
    await taskModel.updateOne({ _id: task._id }, { listId: list._id })
  })
  await t.test('removed members lose access to their own comments', async () => {
    await WorkspaceModel.updateOne({ _id: ws._id }, { $pull: { members: { user: member._id } } })
    assert.equal((await request('GET', `/api/comment/${task._id}`, undefined, mem)).status, 404)
    assert.equal((await request('PUT', `/api/comment/${comment._id}`, { body: 'Stale access' }, mem)).status, 404)
    assert.equal((await request('DELETE', `/api/comment/${comment._id}`, undefined, mem)).status, 404)
    await WorkspaceModel.updateOne({ _id: ws._id }, { $push: { members: { user: member._id, role: 'MEMBER' } } })
  })
  await t.test('posting trims body and mentions never notify the global directory', async () => {
    const result = await request('POST', '/api/comment', { taskId: String(task._id), body: '  Hello @outsider  ' }, mem)
    assert.equal(result.status, 201)
    assert.equal(result.data.payload.body, 'Hello @outsider')
    assert.equal(result.data.payload.author.email, undefined)
    assert.equal(await NotificationModel.countDocuments({ user: outsider._id }), 0)
  })
  await t.test('template visibility matches list, detail and favourite', async () => {
    const result = await request('GET', '/api/templates', undefined, out)
    assert.equal(result.status, 200)
    assert.ok(!result.data.payload.some((item) => item._id === String(draft._id)))
    for (const item of [draft, marker]) {
      assert.equal((await request('GET', `/api/templates/${item._id}`, undefined, out)).status, 404)
      assert.equal((await request('PATCH', `/api/templates/${item._id}/favourite`, {}, out)).status, 404)
    }
    assert.equal((await request('GET', `/api/templates/${draft._id}`, undefined, own)).status, 200)
    const owned = await request('GET', `/api/templates/${draft._id}`, undefined, own)
    assert.equal(owned.data.payload.publishDetails.notes, 'private-note')
    assert.equal(owned.data.payload.favourites, undefined)
  })
  await t.test('public template DTO hides favourite arrays and internal metadata', async () => {
    const result = await request('GET', `/api/templates/${published._id}`, undefined, out)
    assert.equal(result.status, 200)
    assert.equal(result.data.payload.favourites, undefined)
    assert.equal(result.data.payload.publishDetails?.notes, undefined)
    assert.equal(result.data.payload.publishDetails?.contactEmail, undefined)
    const fav = await request('PATCH', `/api/templates/${published._id}/favourite`, {}, out)
    assert.deepEqual(fav.data.payload, { id: String(published._id), favourite: true })
  })
  await t.test('no global role or public edit ownership bypass', async () => {
    for (const item of [draft, published]) {
      assert.equal((await request('PUT', `/api/templates/${item._id}`, { title: 'Hijack' }, out)).status, 403)
      assert.equal((await request('PATCH', `/api/templates/${item._id}/published`, {}, out)).status, 403)
      assert.equal((await request('DELETE', `/api/templates/${item._id}`, undefined, out)).status, 403)
    }
  })
  await t.test('favourites cannot manufacture nonexistent or private project markers', async () => {
    const count = await Template.countDocuments({ type: 'fav-marker' })
    for (const id of [String(project._id), String(new mongoose.Types.ObjectId())]) {
      assert.equal((await request('PATCH', `/api/templates/${id}/favourite`, {}, out)).status, 404)
    }
    assert.equal(await Template.countDocuments({ type: 'fav-marker' }), count)
  })
  await t.test('published project fallback uses safe DTO and scoped management', async () => {
    await projectModel.updateOne({ _id: project._id }, { isPublished: true, isEditable: true, publishDetails: { notes: 'private-project-note', contactEmail: 'private@example.test' } })
    const detail = await request('GET', `/api/templates/${project._id}`, undefined, out)
    assert.equal(detail.status, 200)
    assert.equal(detail.data.payload.type, 'project')
    assert.equal(detail.data.payload.publishDetails?.notes, undefined)
    assert.equal(detail.data.payload.publishDetails?.contactEmail, undefined)
    for (const [method, path, body] of [
      ['PUT', `/api/templates/${project._id}`, { title: 'Hijack' }],
      ['PATCH', `/api/templates/${project._id}/published`, {}],
      ['DELETE', `/api/templates/${project._id}`, undefined]
    ]) assert.equal((await request(method, path, body, out)).status, 403)
    assert.equal((await request('DELETE', `/api/templates/${project._id}`, undefined, own)).status, 200)
    assert.equal((await projectModel.findById(project._id)).isPublished, false)
  })
  await t.test('template writes reject ownership injection and invalid IDs', async () => {
    assert.equal((await request('PUT', `/api/templates/${draft._id}`, { creatorId: String(outsider._id) }, own)).status, 400)
    assert.equal((await request('PUT', `/api/templates/${draft._id}`, { isPublished: 'true' }, own)).status, 400)
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await request(method, '/api/templates/invalid', method === 'PUT' ? { title: 'Valid' } : undefined, own)).status, 400)
    }
  })
})
