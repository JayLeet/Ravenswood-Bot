function getTableOrder(view) {
  return view?.users?.players || []
}

function getLivingTableOrder(view) {
  const alive = new Set(view?.users?.alivePlayers || [])
  return getTableOrder(view).filter(playerId => alive.has(playerId))
}

function getImmediateNeighbors(view, playerId) {
  return getCircularNeighbors(getTableOrder(view), playerId)
}

function getLivingNeighbors(view, playerId) {
  return getCircularNeighbors(getLivingTableOrder(view), playerId)
}

function getCircularNeighbors(order, playerId) {
  if (!playerId || !Array.isArray(order) || order.length < 2) {
    return { left: null, right: null }
  }

  const index = order.indexOf(playerId)
  if (index < 0) return { left: null, right: null }
  if (order.length === 2) {
    const neighbor = order[index === 0 ? 1 : 0]
    return { left: neighbor, right: neighbor }
  }

  return {
    left: order[(index - 1 + order.length) % order.length],
    right: order[(index + 1) % order.length]
  }
}

function formatNeighborPair(pair, formatter) {
  if (!pair?.left && !pair?.right) return 'None'
  const format = typeof formatter === 'function' ? formatter : value => String(value)
  if (pair.left && pair.left === pair.right) return format(pair.left)
  return [pair.left, pair.right].filter(Boolean).map(format).join(' / ')
}

module.exports = {
  formatNeighborPair,
  getImmediateNeighbors,
  getLivingNeighbors,
  getLivingTableOrder,
  getTableOrder
}
