function createPlayerLabel(game, view, playerId, discordMember = null) {
  return discordMember?.displayName ||
    discordMember?.nickname ||
    discordMember?.user?.globalName ||
    discordMember?.user?.displayName ||
    discordMember?.user?.username ||
    view?.users?.displayNames?.[playerId] ||
    game.users?.[playerId]?.displayName ||
    game.users?.[playerId]?.username ||
    `Player ${String(playerId).slice(-4)}`
}

function createDiscordPermissionAccess(game, gameLifecycle, access) {
  return {
    ...access,
    invitedPlayerIds: (access.invitedPlayerIds || [])
      .filter(playerId => !gameLifecycle?.isFakePlayer?.(game, playerId))
  }
}

module.exports = {
  createDiscordPermissionAccess,
  createPlayerLabel
}
