function getStorytellerControlledPlayer(service, manager, guildId, member, playerId) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(service.errorTypes.PERMISSION_DENIED, 'Not storyteller')
  }

  if (!playerId || manager.getRole(game, playerId) !== 'player') {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'Select a player in the active game first'
    )
  }

  return manager.createSuccess({ game })
}

function getStorytellerControlledLobby(service, manager, guildId, member) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(service.errorTypes.PERMISSION_DENIED, 'Not storyteller')
  }

  if (game.state !== 'lobby') {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'Random role distribution is only available before the game starts.'
    )
  }

  return manager.createSuccess({ game })
}

module.exports = {
  getStorytellerControlledLobby,
  getStorytellerControlledPlayer
}
