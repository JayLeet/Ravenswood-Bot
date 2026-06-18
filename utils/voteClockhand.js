function getClockhandOrder({
  playerIds = [],
  alivePlayerIds = [],
  deadPlayerIds = [],
  deadVotes = {},
  votes = [],
  nominationId = null,
  startPlayerId = null
} = {}) {
  const alive = new Set(alivePlayerIds)
  const dead = new Set(deadPlayerIds)
  const raised = new Set((votes || [])
    .filter(vote => vote.nominationId === nominationId && vote.value === true)
    .map(vote => vote.userId))

  return rotateAfter(playerIds, startPlayerId)
    .filter(userId => alive.has(userId) || (dead.has(userId) && (deadVotes[userId] !== false || raised.has(userId))))
}

function getClockhandState(input = {}, countedPlayerIds = []) {
  const order = getClockhandOrder(input)
  const orderSet = new Set(order)
  const counted = [...new Set(countedPlayerIds || [])].filter(userId => orderSet.has(userId))
  const countedSet = new Set(counted)
  const currentId = order.find(userId => !countedSet.has(userId)) || null

  return {
    order,
    counted,
    currentId,
    total: order.length,
    complete: !!order.length && !currentId
  }
}

function getNextClockhandPlayerId(input = {}, countedPlayerIds = []) {
  return getClockhandState(input, countedPlayerIds).currentId
}

function rotateAfter(playerIds, startPlayerId) {
  const ids = [...new Set(playerIds || [])]
  if (!ids.length || !startPlayerId) return ids

  const index = ids.indexOf(startPlayerId)
  if (index < 0) return ids
  return [...ids.slice(index + 1), ...ids.slice(0, index + 1)]
}

module.exports = {
  getClockhandOrder,
  getClockhandState,
  getNextClockhandPlayerId,
  rotateAfter
}
