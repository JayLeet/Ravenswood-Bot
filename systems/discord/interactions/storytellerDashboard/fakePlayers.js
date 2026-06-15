function isFakeDashboardPlayer(context, playerId) {
  return (context.view?.users?.fakePlayers || []).includes(playerId)
}

function formatDashboardPlayer(context, playerId) {
  if (!isFakeDashboardPlayer(context, playerId)) return `<@${playerId}>`
  return context.view?.users?.displayNames?.[playerId] || `Test Player ${String(playerId).slice(-4)}`
}

function createFakeDiscordOnlyFailure(context, playerId, actionLabel) {
  return {
    result: {
      ok: false,
      error: {
        message: createFakeDiscordOnlyMessage(context, playerId, actionLabel)
      }
    }
  }
}

function createFakeDiscordOnlyDashboardFailure(context, playerId, actionLabel) {
  return {
    title: 'Fake test player skipped',
    message: createFakeDiscordOnlyMessage(context, playerId, actionLabel),
    suggestion: 'Use a real Discord member for Discord-only delivery, or treat this as a successful fake-game skip.'
  }
}

function createFakeDiscordOnlyMessage(context, playerId, actionLabel) {
  const playerLabel = formatDashboardPlayer(context, playerId)
  return `${playerLabel} is a fake test player, so Discord-only actions like ${actionLabel} are skipped.`
}

module.exports = {
  createFakeDiscordOnlyDashboardFailure,
  createFakeDiscordOnlyFailure,
  createFakeDiscordOnlyMessage,
  formatDashboardPlayer,
  isFakeDashboardPlayer
}
