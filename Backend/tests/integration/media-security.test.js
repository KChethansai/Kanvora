import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'
import { UserModel } from '../../models/usermodel.js'
import { WorkspaceModel } from '../../models/Workspace.js'
import { projectModel } from '../../models/ProjectModel.js'
import { ListModel } from '../../models/ListModel.js'
import { taskModel } from '../../models/Taskmodel.js'

test('attachment delivery is authorized and does not expose embedded URLs to outsiders', async (t) => {
  const api = await testApi(t)
  const [owner, member, outsider] = await UserModel.create(['Media owner', 'Media member', 'Media outsider'].map((name, index) => ({
    name, email: `media-${index}@example.test`, password: 'synthetic-password', emailVerified: true
  })))
  const workspace = await WorkspaceModel.create({ name: 'Media', owner: owner._id, members: [{ user: member._id, role: 'MEMBER' }] })
  const project = await projectModel.create({ name: 'Private media', workspace: workspace._id, creatorId: owner._id })
  const list = await ListModel.create({ title: 'Media', projectId: project._id })
  const card = await taskModel.create({
    title: 'Media card', projectId: project._id, listId: list._id,
    attachment: [{ name: 'private.png', url: 'https://media.example/private.png', fileType: 'image/png', size: 10 }]
  })
  const authenticated = await taskModel.create({
    title: 'Authenticated media', projectId: project._id, listId: list._id,
    attachment: [{
      name: 'private-auth.png', url: 'https://media.example/unsigned.png', publicId: 'private-asset',
      storage: 'authenticated', fileType: 'image/png', size: 10
    }]
  })
  const attachmentId = String(card.attachment[0]._id)
  const authenticatedId = String(authenticated.attachment[0]._id)
  const tokens = await Promise.all([owner, member, outsider].map(api.tokenFor))

  assert.equal((await api.request('GET', `/projects-api/attachments/${attachmentId}`)).status, 401)
  assert.equal((await api.request('GET', '/projects-api/attachments/not-an-id', undefined, tokens[0])).status, 400)
  assert.equal((await api.request('GET', `/projects-api/attachments/${attachmentId}`, undefined, tokens[2])).status, 404)
  assert.equal((await api.request('GET', `/projects-api/attachments/${authenticatedId}`, undefined, tokens[2])).status, 404)
  const allowed = await api.request('GET', `/projects-api/attachments/${attachmentId}`, undefined, tokens[1])
  assert.equal(allowed.status, 302)
  assert.equal(allowed.headers.get('location'), 'https://media.example/private.png')
  assert.equal(allowed.headers.get('cache-control'), 'private, no-store')
  const signed = await api.request('GET', `/projects-api/attachments/${authenticatedId}`, undefined, tokens[1])
  assert.equal(signed.status, 302)
  assert.match(signed.headers.get('location'), /type=authenticated/)
  assert.match(signed.headers.get('location'), /signature=[a-f0-9]{40}/)
  assert.notEqual(signed.headers.get('location'), 'https://media.example/unsigned.png')
})
