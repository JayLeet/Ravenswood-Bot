const {
  countActiveReminders,
  formatNightActionSummary,
  formatStatusEffects,
  getLatestNightAction,
  getLatestSuggestedInfo,
  getRoleDisplayName,
  truncate
} = require('./formatters')

function createGrimoireFields(view, playerLabels = {}) {
  const lines = (view.users.players || []).map(userId =>
    formatGrimoireLine(view, userId, playerLabels)
  )

  if (!lines.length) return []
  return chunkLines('Grimoire', lines)
}

function formatGrimoireLine(view, userId, playerLabels = {}) {
  const role = view.engine.roles?.[userId]
  const status = formatStatusEffects(view.engine.statusEffects?.[userId]) || 'Clear'
  const reminders = countActiveReminders(view, userId)
  const nightAction = formatNightActionSummary(getLatestNightAction(view, userId))
  const suggestedInfo = getLatestSuggestedInfo(view, userId) || 'None'

  return [
    `${playerLabels[userId] || `<@${userId}>`}: ${formatLifeState(view, userId)}`,
    `Role ${formatGrimoireRole(view, userId, role)}`,
    `Status ${status}`,
    `Reminders ${reminders}`,
    `Night ${truncate(nightAction, 80)}`,
    `Info ${truncate(suggestedInfo, 80)}`,
    `Nom ${formatNominationUsage(view, userId)}`
  ].join(' | ')
}

function formatGrimoireRole(view, userId, role) {
  if (!role) return 'Unassigned'

  const roleName = getRoleDisplayName(view, role)
  const shownRole = view.engine.shownRoles?.[userId]
  if (!shownRole || shownRole === role) return roleName

  return `${roleName} shown as ${getRoleDisplayName(view, shownRole)}`
}

function formatLifeState(view, userId) {
  if (!(view.users.deadPlayers || []).includes(userId)) return 'Alive'
  return view.engine.deadVotes?.[userId] === false
    ? 'Dead, ghost vote spent'
    : 'Dead, ghost vote available'
}

function formatNominationUsage(view, userId) {
  const currentDay = view.day || 1
  const nominations = view.engine.nominations || []
  const wasNominated = nominations.some(item =>
    item.day === currentDay && item.nomineeId === userId
  )
  const nominatedSomeone = nominations.some(item =>
    item.day === currentDay && item.nominatorId === userId
  )

  return [
    nominatedSomeone ? 'used nomination' : 'can nominate',
    wasNominated ? 'nominated today' : 'can be nominated'
  ].join(', ')
}

function chunkLines(baseName, lines) {
  const fields = []
  let current = []
  let length = 0

  for (const line of lines) {
    const nextLength = length + line.length + 1
    if (current.length && nextLength > 1000) {
      fields.push(createField(baseName, fields.length, current))
      current = []
      length = 0
    }

    current.push(line)
    length += line.length + 1
  }

  if (current.length) fields.push(createField(baseName, fields.length, current))
  return fields
}

function createField(baseName, index, lines) {
  return {
    name: index === 0 ? baseName : `${baseName} ${index + 1}`,
    value: lines.join('\n'),
    inline: false
  }
}

module.exports = {
  createGrimoireFields,
  formatGrimoireLine,
  formatGrimoireRole,
  formatLifeState,
  formatNominationUsage
}
