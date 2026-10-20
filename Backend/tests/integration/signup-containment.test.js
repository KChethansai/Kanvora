import test from 'node:test'
import assert from 'node:assert/strict'
import { testApi } from '../helpers/api.js'

test('public registration cannot grant a global management role', async (t) => {
  const api = await testApi(t)
  const { UserModel } = await import('../../models/usermodel.js')
  const response = await api.request('POST', '/auth/register', {
    name: 'Synthetic account', email: 'signup@example.test', password: 'Synthetic password 123!', role: 'MANAGER'
  })
  assert.equal(response.status, 201)
  assert.equal((await UserModel.findOne({ email: 'signup@example.test' })).role, 'MEMBER')
})
