// Project analytics: grouped aggregates instead of a full board read.
//
// The board is never materialised. Totals come from counts and the breakdowns
// from grouped aggregations, so the peak memory is bounded by the number of
// groups rather than by the number of cards on the board.
export const analyticsPipeline = (projectId, listCollection, now) => [
  { $match: { projectId, isActive: true } },
  // A card belongs to the board only when its list belongs to the board too.
  { $lookup: { from: listCollection, localField: 'listId', foreignField: '_id', as: '_lists' } },
  { $match: { '_lists.projectId': projectId } },
  { $project: { status: 1, priority: 1, dueDate: 1, memberId: 1 } },
  {
    $facet: {
      totals: [{ $count: 'count' }],
      byStatus: [{ $group: { _id: { $ifNull: ['$status', 'UNSET'] }, count: { $sum: 1 } } }],
      byPriority: [{ $group: { _id: { $ifNull: ['$priority', 'MEDIUM'] }, count: { $sum: 1 } } }],
      overdue: [
        { $match: { dueDate: { $ne: null, $lt: now }, status: { $ne: 'DONE' } } },
        { $count: 'count' }
      ],
      workload: [{ $group: { _id: { $ifNull: ['$memberId', 'unassigned'] }, count: { $sum: 1 } } }]
    }
  }
]

const counted = (rows) => Number(rows?.[0]?.count || 0)
const grouped = (rows) => Object.fromEntries((rows || []).map((row) => [String(row._id), row.count]))

// Fold the aggregated facets back into the analytics response shape.
export const foldAnalytics = (facets, { lists = 0, activity = 0 } = {}) => {
  const facet = facets?.[0] || {}
  return {
    totals: { lists, cards: counted(facet.totals), activity },
    byStatus: grouped(facet.byStatus),
    byPriority: grouped(facet.byPriority),
    overdue: counted(facet.overdue),
    workload: grouped(facet.workload)
  }
}
