import test from 'node:test'
import assert from 'node:assert/strict'
import { connectTestDatabase } from '../helpers/database.js'

test('isolated replica set supports atomic rollback without touching existing collections', async () => {
  const connection = await connectTestDatabase()
  const collection = connection.collection(`infrastructure_${process.pid}_${Date.now()}`)
  const session = await connection.startSession()
  try {
    await collection.insertOne({ baseline: true })
    await assert.rejects(session.withTransaction(async () => {
      await collection.insertOne({ rolledBack: true }, { session })
      throw new Error('deliberate test rollback')
    }), /deliberate test rollback/)
    assert.equal(await collection.countDocuments({ rolledBack: true }), 0)
    assert.equal(await collection.countDocuments({ baseline: true }), 1)
  } finally {
    await session.endSession()
    await collection.drop()
    await connection.close()
  }
})
