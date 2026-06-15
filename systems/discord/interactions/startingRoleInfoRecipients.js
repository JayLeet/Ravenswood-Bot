function getStartingRoleInfoRecipients(game) {
  const order = Array.isArray(game?.alivePlayers) && game.alivePlayers.length
    ? game.alivePlayers
    : Object.keys(game?.users || {})
  const seen = new Set()

  return order.filter(userId => {
    if (seen.has(userId)) return false
    seen.add(userId)
    const user = game?.users?.[userId]
    return user?.role === 'player' &&
      Boolean(game?.roles?.[userId]) &&
      shouldSendStartingRoleInfo(game, userId)
  })
}

function shouldSendStartingRoleInfo(game, userId) {
  if (!game?.roleInfoSent?.[userId]) return true
  if (game?.roleInfoPromptMessages?.[userId]) return false
  return Number(game?.day || 1) > 1
}

module.exports = {
  getStartingRoleInfoRecipients,
  shouldSendStartingRoleInfo
}
