import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTemplateDto } from '../controllers/templateDto.js'

const caller = 'user-1'

const template = (overrides = {}) => ({
  _id: 'template-1',
  title: 'Launch board',
  description: 'A board template',
  category: 'Marketing',
  creatorId: 'user-1',
  creatorName: 'Owner',
  images: ['https://cdn.example.test/a.png'],
  isPublished: true,
  isEditable: false,
  publishDetails: { companyName: 'Kanvora', website: 'https://example.test', templateType: 'board', category: 'Marketing' },
  favourites: [],
  ...overrides
})

test('an owned template serialises edit and delete capabilities', () => {
  const dto = buildTemplateDto(template(), caller)

  assert.deepEqual(dto.capabilities, { edit: true, delete: true })
  assert.equal(dto.isViewOnly, false)
  assert.equal(dto.type, 'template')
  assert.equal(dto.favourite, false)
  assert.equal(dto.allowPublicEdit, false)
})

test('a template owned by somebody else serialises no write capabilities', () => {
  const dto = buildTemplateDto(template({ creatorId: 'user-2', creatorName: 'Somebody else' }), caller)

  assert.deepEqual(dto.capabilities, { edit: false, delete: false })
  assert.equal(dto.isViewOnly, true)
})

test('a project-backed template serialises the injected write capability', () => {
  const project = {
    _id: 'project-1',
    title: 'Roadmap',
    description: 'A project',
    creatorId: { _id: 'user-2', name: 'Owner' },
    img: 'https://cdn.example.test/p.png',
    isPublished: true,
    isEditable: false,
    publishDetails: { category: 'Roadmap' },
    favourites: []
  }

  const writable = buildTemplateDto(project, caller, 'project', true, true)
  assert.deepEqual(writable.capabilities, { edit: true, delete: true })
  assert.equal(writable.isViewOnly, false)
  assert.equal(writable.type, 'project')
  assert.equal(writable.favourite, true)
  assert.equal(writable.category, 'Roadmap')
  assert.equal(writable.creatorName, 'Owner')
  assert.deepEqual(writable.images, ['https://cdn.example.test/p.png'])

  const readOnly = buildTemplateDto(project, caller, 'project', false, false)
  assert.deepEqual(readOnly.capabilities, { edit: false, delete: false })
  assert.equal(readOnly.isViewOnly, true)
})

test('a project-backed template never derives write access from the creator field', () => {
  const project = {
    _id: 'project-2',
    title: 'Roadmap',
    creatorId: { _id: caller, name: 'Owner' },
    publishDetails: {},
    favourites: []
  }

  const dto = buildTemplateDto(project, caller, 'project', false, false)

  assert.deepEqual(dto.capabilities, { edit: false, delete: false })
  assert.equal(dto.isViewOnly, true)
})
