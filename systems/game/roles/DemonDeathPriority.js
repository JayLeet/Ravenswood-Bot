function getDemonDeathPriority(role, behavior = null) {
  if (role?.id === 'scarlet_woman') return 0
  return 1 + normalizePriority(behavior?.demonDeathPriority)
}

function normalizePriority(value) {
  const priority = Number(value)
  return Number.isFinite(priority) && priority >= 0 ? priority : 100
}

module.exports = {
  getDemonDeathPriority,
  normalizePriority
}
