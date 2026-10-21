// Board writes: the board a publish route exists for is publishable, an
// attachment is appended atomically, a member keeps every field of its entry
// and an invitation survives a concurrent invite.
import test from 'node:test'
import assert from 'node:assert/strict'

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_URL: 'mongodb://127.0.0.1:1/kanvora_test',
  SECRET_KEY: 'synthetic-test-key-only',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
})

const ownerId = 'a'.repeat(24)
const memberId = 'b'.repeat(24)
const outsiderId = 'c'.repeat(24)
const projectId = 'd'.repeat(24)
const templateId = 'e'.repeat(24)

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

// A query double: awaiting it resolves the document, and it keeps the
// populate chain the controllers use.
const modelQuery = (document) => ({
  populate: () => modelQuery(document),
  then: (resolve, reject) => Promise.resolve(document).then(resolve, reject)
})

const fakeBoard = (overrides = {}) => ({
  _id: projectId,
  name: 'Roadmap',
  title: 'Roadmap',
  description: '',
  status: true,
  archivedAt: null,
  isPublished: false,
  isEditable: false,
  workspace: null,
  creatorId: ownerId,
  membershipVersion: 1,
  directGrants: [],
  publishDetails: {},
  img: null,
  save: async () => {},
  ...overrides
})

test('an unpublished board can be published through the publish route', async (t) => {
  const { togglePublished } = await import('../controllers/templeteContoler.js')
  const { projectModel } = await import('../models/ProjectModel.js')
  const { Template } = { Template: (await import('../models/template.js')).default }

  const board = fakeBoard()
  const filters = []
  t.mock.method(Template, 'findOne', async () => null)
  t.mock.method(projectModel, 'findOne', async (filter) => {
    filters.push(filter)
    // The database honours the filter: an unpublished board does not match a
    // query that demands a published board.
    if (filter.isPublished && !board.isPublished) return null
    return board
  })
  t.mock.method(projectModel, 'findById', () => ({ session: () => board }))

  const res = fakeResponse()
  await togglePublished({ params: { id: projectId }, user: { id: ownerId } }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.payload.isPublished, true)
  // The lookup never asks for a published board: that filter is what made the
  // route unable to find the board it exists to publish.
  assert.equal(filters.length, 1)
  assert.equal(filters[0].isPublished, undefined)
  assert.equal(filters[0].status, true)
  assert.equal(filters[0].archivedAt, null)
})

test('a board the caller may not manage is still refused', async (t) => {
  const { togglePublished } = await import('../controllers/templeteContoler.js')
  const { projectModel } = await import('../models/ProjectModel.js')
  const { Template } = { Template: (await import('../models/template.js')).default }

  const board = fakeBoard({ creatorId: ownerId })
  t.mock.method(Template, 'findOne', async () => null)
  t.mock.method(projectModel, 'findOne', async () => board)
  t.mock.method(projectModel, 'findById', () => ({ session: () => board }))

  const res = fakeResponse()
  await togglePublished({ params: { id: projectId }, user: { id: outsiderId } }, res, (err) => { throw err })

  // The authorisation check is unchanged: a caller without manage rights on
  // the board is refused.
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.message, 'Not authorized')
  assert.equal(board.isPublished, false)
})

test('a favourite leaves one marker document behind', async (t) => {
  const { toggleFavourite } = await import('../controllers/templeteContoler.js')
  const { projectModel } = await import('../models/ProjectModel.js')
  const Template = (await import('../models/template.js')).default

  const board = fakeBoard({ isPublished: true })
  const documents = []
  const makeMarker = (favourites) => ({
    _id: `marker-${documents.length}`,
    type: 'fav-marker',
    projectRef: projectId,
    title: `fav-marker-${projectId}`,
    creatorId: ownerId,
    creatorName: 'system',
    category: 'system',
    favourites
  })
  // Two markers for the same board: the state a concurrent favourite leaves
  // behind when the marker is created by a find-then-create sequence.
  documents.push(makeMarker([ownerId]))
  documents.push(makeMarker([]))

  t.mock.method(Template, 'findOne', async (filter) => {
    if (filter.type === 'fav-marker') return documents.find((doc) => String(doc.projectRef) === String(filter.projectRef)) || null
    return null
  })
  t.mock.method(Template, 'findOneAndUpdate', async (filter, update) => {
    let marker = documents.find((doc) => doc.type === 'fav-marker' && String(doc.projectRef) === String(filter.projectRef))
    if (!marker) {
      marker = makeMarker([])
      documents.push(marker)
    }
    if (update.$setOnInsert && !marker.favourites.length) marker.favourites = []
    return marker
  })
  t.mock.method(Template, 'find', (filter) => ({
    select: () => ({
      then: (resolve) => resolve(documents.filter((doc) =>
        doc.type === 'fav-marker' &&
        String(doc.projectRef) === String(filter.projectRef) &&
        (!filter._id?.$ne || doc._id !== filter._id.$ne)))
    })
  }))
  t.mock.method(Template, 'updateOne', async (filter, update) => {
    const marker = documents.find((doc) => doc._id === filter._id)
    if (!marker) return
    if (update.$set?.favourites) marker.favourites = update.$set.favourites
    if (update.$addToSet?.favourites && !marker.favourites.includes(update.$addToSet.favourites)) {
      marker.favourites.push(update.$addToSet.favourites)
    }
    if (update.$pull?.favourites) marker.favourites = marker.favourites.filter((id) => id !== update.$pull.favourites)
  })
  t.mock.method(Template, 'deleteMany', async (filter) => {
    for (let index = documents.length - 1; index >= 0; index -= 1) {
      if (filter._id?.$in?.includes(documents[index]._id)) documents.splice(index, 1)
    }
  })
  t.mock.method(projectModel, 'findOne', () => modelQuery(board))
  t.mock.method(projectModel, 'findById', () => ({ session: () => board }))

  const res = fakeResponse()
  await toggleFavourite({ params: { id: projectId }, user: { id: ownerId } }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  // One board keeps one marker, so the favourites of an address never split
  // across two documents.
  assert.equal(documents.length, 1)
  assert.deepEqual(documents[0].favourites.map(String), [ownerId])
})

test('an attachment is appended atomically and keeps every upload', async (t) => {
  const { appendAttachment } = await import('../utils/cardAttachments.js')
  const { taskModel } = await import('../models/Taskmodel.js')

  const card = { _id: 'f'.repeat(24), attachment: [] }
  const updates = []
  t.mock.method(taskModel, 'findOneAndUpdate', async (filter, update) => {
    updates.push({ filter, update })
    // The database applies an atomic push: every upload is kept.
    card.attachment.push(update.$push.attachment)
    return card
  })

  await Promise.all([
    appendAttachment({ cardId: card._id, attachment: { name: 'one.png' } }),
    appendAttachment({ cardId: card._id, attachment: { name: 'two.png' } })
  ])

  assert.equal(updates.length, 2)
  for (const { filter, update } of updates) {
    // The card document is never rewritten: only the attachment array grows.
    assert.deepEqual(Object.keys(update), ['$push'])
    assert.equal(update.$push.attachment.name !== undefined, true)
    assert.equal(filter.isActive, true)
  }
  assert.deepEqual(card.attachment.map((entry) => entry.name), ['one.png', 'two.png'])
})

test('a stored attachment name is a plain name', async (t) => {
  const { safeFileName } = await import('../utils/cardAttachments.js')
  assert.equal(safeFileName('photo.png'), 'photo.png')
  assert.equal(safeFileName('../../etc/passwd'), 'passwd')
  assert.equal(safeFileName('C:\\Users\\me\\photo.png'), 'photo.png')
  assert.equal(safeFileName('evil\u0000.png'), 'evil.png')
  assert.equal(safeFileName('evil\nname.png'), 'evilname.png')
  assert.equal(safeFileName('   '), 'attachment')
  assert.equal(safeFileName(undefined), 'attachment')
  assert.equal(safeFileName('x'.repeat(400)).length, 255)
})

test('the upload route is rate limited', async (t) => {
  const { projectsApp } = await import('../APIs/ProjectsAPI.js')
  const { uploadLimiter } = await import('../config/security.js')
  const layer = projectsApp.stack.find((entry) => entry.route?.path === '/cards/:id/attachments' && entry.route.methods.post)
  assert.ok(layer, 'the attachment upload route must exist')
  assert.ok(
    layer.route.stack.some((entry) => entry.handle === uploadLimiter),
    'the attachment upload route must carry the upload rate limiter'
  )
})

test('a member keeps every field of its workspace entry when the role changes', async (t) => {
  const { changeMemberRole } = await import('../controllers/workspaceController.js')
  const { WorkspaceModel } = await import('../models/Workspace.js')

  const memberEntry = { _id: 'member-entry-1', user: memberId, role: 'MEMBER', joinedAt: new Date('2026-01-01T00:00:00.000Z') }
  const workspace = {
    _id: '1'.repeat(24),
    name: 'Team',
    status: true,
    owner: ownerId,
    members: [memberEntry],
    permissions: {},
    markModified() {},
    save: async () => {}
  }
  t.mock.method(WorkspaceModel, 'findById', async () => workspace)

  const res = fakeResponse()
  await changeMemberRole({
    params: { id: workspace._id, userId: memberId },
    body: { role: 'VIEWER' },
    user: { id: ownerId }
  }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  assert.equal(workspace.members.length, 1)
  // The entry is changed in place: its identity and its other fields survive.
  assert.equal(workspace.members[0]._id, 'member-entry-1')
  assert.equal(workspace.members[0].joinedAt.toISOString(), '2026-01-01T00:00:00.000Z')
  assert.equal(workspace.members[0].role, 'VIEWER')
})

test('a concurrent invite for the same address does not fail the request', async (t) => {
  const { addMember } = await import('../controllers/workspaceController.js')
  const { WorkspaceModel } = await import('../models/Workspace.js')
  const { UserModel } = await import('../models/usermodel.js')
  const { ActivityModel } = await import('../models/Activity.js')
  const InvitationModel = (await import('../models/Invitation.js')).default

  const workspace = {
    _id: '2'.repeat(24),
    name: 'Team',
    status: true,
    owner: ownerId,
    members: [],
    permissions: {}
  }
  const calls = []
  t.mock.method(WorkspaceModel, 'findById', async () => workspace)
  t.mock.method(UserModel, 'findOne', () => ({ select: () => ({ then: (resolve) => resolve(null) }) }))
  t.mock.method(ActivityModel, 'create', async () => { throw new Error('no activity in this test') })
  t.mock.method(InvitationModel, 'findOneAndUpdate', async (filter, update, options) => {
    calls.push({ filter, update, options })
    if (calls.length === 1) {
      // The concurrent invite won the unique token index.
      const error = new Error('E11000 duplicate key error collection')
      error.code = 11000
      throw error
    }
    return { _id: 'invitation-1', ...filter, ...update.$set }
  })
  t.mock.method(InvitationModel, 'deleteMany', async () => ({ deletedCount: 0 }))

  const res = fakeResponse()
  await addMember({
    params: { id: workspace._id },
    body: { email: 'teammate@example.test', role: 'MEMBER' },
    user: { id: ownerId },
    app: { locals: { sendEmail: async () => {} } }
  }, res, (err) => { throw err })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.message, 'Invitation sent')
  // The write was retried as an update instead of failing the request.
  assert.equal(calls.length, 2)
  assert.equal(calls[0].options.upsert, true)
  assert.equal(calls[1].options?.upsert, undefined)
})
