const {
  getTableOrder
} = require('./tableOrder')

function createTableOrderField(view, playerLabels = {}) {
  const order = getTableOrder(view)
  if (!order.length) return null
  return {
    name: 'Table order',
    value: formatTableOrder(order, playerLabels),
    inline: false
  }
}

function formatTableOrder(order, playerLabels = {}) {
  const text = order
    .map(userId => playerLabels[userId] || `Player ${String(userId).slice(-4)}`)
    .join(' → ')
  return text.length <= 1024 ? text : `${text.slice(0, 1021)}...`
}

module.exports = {
  createTableOrderField,
  formatTableOrder
}
