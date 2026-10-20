// Transaction helpers: make multi-document board mutations atomic and give
// lists/cards server-owned order values that cannot collide under concurrency.
import mongoose from 'mongoose'

export async function withTransaction(work) {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => work(session), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    })
  } finally {
    await session.endSession()
  }
}

// Allocate the next value for a monotonically increasing order counter. Legacy
// documents may predate the counter or have higher orders from before this
// contract, so seed from the current maximum before incrementing.
export async function nextSequence({ model, filter, field, session, maxOrder }) {
  const currentMax = await maxOrder()
  const maximum = Number.isFinite(currentMax) ? currentMax : -1
  const document = await model.findOne(filter).select(field).session(session)
  if (!document) return null
  if ((document[field] ?? -1) < maximum) {
    await model.updateOne({ _id: document._id }, { $max: { [field]: maximum } }, { session })
  }
  return model.findOneAndUpdate(filter, { $inc: { [field]: 1 } }, { new: true, session })
}
