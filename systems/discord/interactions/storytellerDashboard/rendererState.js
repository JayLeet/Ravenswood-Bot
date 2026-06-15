function pruneDashboardMessageSignatures(messageSignatures, serverConfigs) {
  const activeMessageIds = new Set([...serverConfigs.values()]
    .flatMap(getTrackedDashboardMessageIds)
    .filter(Boolean))
  let removed = 0

  for (const messageId of messageSignatures.keys()) {
    if (activeMessageIds.has(messageId)) continue
    messageSignatures.delete(messageId)
    removed += 1
  }

  return removed
}

function getTrackedDashboardMessageIds(serverConfig = {}) {
  return [
    serverConfig.storytellerDashboardMessageId,
    serverConfig.storytellerNightOrderGuidanceMessageId,
    serverConfig.storytellerNominationDashboardMessageId
  ]
}

function isFakePlayer(view, userId) {
  return (view.users.fakePlayers || []).includes(userId)
}

function createFakePlayerLabel(userId) {
  return `Test Player ${String(userId).slice(-4)}`
}

function createFallbackPlayerLabel(userId) {
  return `Player ${String(userId).slice(-4)}`
}

module.exports = {
  createFakePlayerLabel,
  createFallbackPlayerLabel,
  isFakePlayer,
  pruneDashboardMessageSignatures
}
