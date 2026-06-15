const {
  createNightWakeEntries
} = require('../../embeds')

function findReplacementWakeEntry(view, labels, state, oldEntry) {
  const replacement = createNightWakeEntries(view, labels)[state.index]
  if (!replacement) return null
  if (replacement.action?.id === oldEntry.action?.id) return null
  if (replacement.playerId !== oldEntry.playerId) return null
  return replacement
}

function isPermanentFirstNightInfo(action) {
  return action?.firstNightRoleInfo === true ||
    action?.purpose === 'first_night_info' ||
    action?.purpose === 'starting_role_info' ||
    action?.purpose === 'role_change_info'
}

function isResolvedPermanentFirstNightInfo(action) {
  return action?.status === 'resolved' && isPermanentFirstNightInfo(action)
}

function shouldSkipAlreadySentFirstNightInfo(game, entry) {
  const action = entry?.action
  const isStartingInfo = action?.firstNightRoleInfo === true ||
    action?.purpose === 'first_night_info' ||
    action?.purpose === 'starting_role_info'
  if (!isStartingInfo) return false
  if (action?.purpose === 'role_change_info') return false
  const playerId = entry?.playerId || action?.actorId || action?.playerId
  if (!playerId) return false
  return Boolean(game?.roleInfoPromptMessages?.[playerId] || game?.roleInfoSent?.[playerId])
}

function shouldSendTargetPrompt(action) {
  return !['self', 'text'].includes(action?.targetType)
}

module.exports = {
  findReplacementWakeEntry,
  isPermanentFirstNightInfo,
  isResolvedPermanentFirstNightInfo,
  shouldSendTargetPrompt,
  shouldSkipAlreadySentFirstNightInfo
}
