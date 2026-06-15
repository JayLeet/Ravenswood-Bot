const {
  formatRoleName,
  formatRoleWithEmoji
} = require('../roleFormatting')

function formatStatusEffects(effects = {}) {
  return Object.entries(effects)
    .filter(([, active]) => active)
    .map(([effect]) => formatRoleName(effect))
    .join(', ')
}

function countActiveReminders(view, playerId = null) {
  return (view.engine.reminders || []).filter(reminder => {
    if (playerId && reminder.playerId !== playerId) return false
    return reminder.status !== 'triggered'
  }).length
}

function getLatestNightAction(view, playerId) {
  return [...(view.engine.nightActions || [])]
    .reverse()
    .find(action => action.actorId === playerId || action.playerId === playerId) || null
}

function getLatestSuggestedInfo(view, playerId) {
  const action = [...(view.engine.nightActions || [])]
    .reverse()
    .find(item =>
      (item.actorId === playerId || item.playerId === playerId) &&
      item.status === 'resolved' &&
      (item.result?.suggestedInfo || item.result?.summary)
    )

  return action?.result?.suggestedInfo || action?.result?.summary || ''
}

function getLatestNomination(view, playerId) {
  return [...(view.engine.nominations || [])]
    .reverse()
    .find(nomination => nomination.nomineeId === playerId) || null
}

function formatNominationSummary(nomination) {
  if (!nomination) return 'None'

  if (nomination.status === 'pending_second') return 'Waiting for second'
  if (nomination.status === 'seconded') return 'Seconded'
  if (nomination.status === 'voting') {
    return `${nomination.yesVotes || 0}/${nomination.threshold || '?'} yes`
  }
  if (nomination.status === 'resolved') {
    if (nomination.result === 'marked_for_execution') return 'Marked for execution'
    if (nomination.result === 'tied_execution_candidate') return 'Tied count'
    return nomination.executed ? 'Executed' : 'No execution'
  }

  return formatRoleName(nomination.status || 'unknown')
}

function formatNightActionSummary(action) {
  if (!action) return 'None'

  const targets = action.targetIds?.length
    ? action.targetIds.map(targetId => `<@${targetId}>`).join(', ')
    : action.targetId ? `<@${action.targetId}>` : ''
  const target = targets ? ` -> ${targets}` : ''
  const role = action.roleName ? `${action.roleName}: ` : ''
  const result = action.result?.summary ? ` | ${action.result.summary}` : ''
  return `${role}${formatRoleName(action.status || 'unknown')}${target}${result}`
}

function getRoleDisplayName(view, roleId) {
  return formatRoleWithEmoji(view, roleId)
}

function formatCategory(category) {
  return formatRoleName(category)
}

function formatState(state) {
  if (state === 'in-game') return 'Live'
  return formatRoleName(state || 'unknown')
}

function truncate(value, maxLength) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

module.exports = {
  countActiveReminders,
  formatCategory,
  formatNightActionSummary,
  formatNominationSummary,
  formatRoleName,
  formatState,
  formatStatusEffects,
  getLatestNightAction,
  getLatestNomination,
  getLatestSuggestedInfo,
  getRoleDisplayName,
  truncate
}
