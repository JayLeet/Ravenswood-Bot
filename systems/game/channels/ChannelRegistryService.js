class ChannelRegistryService {
  registerNightChannel(game, playerId, channelId) {
    game.nightChannels ??= {}
    game.nightChannels[playerId] = channelId
  }

  unregisterNightChannel(game, playerId) {
    if (game.nightChannels) delete game.nightChannels[playerId]
  }

  registerNightVoiceChannel(game, playerId, channelId) {
    game.nightVoiceChannels ??= {}
    game.nightVoiceChannels[playerId] = channelId
  }

  unregisterNightVoiceChannel(game, playerId) {
    if (game.nightVoiceChannels) delete game.nightVoiceChannels[playerId]
  }

  registerStorytellerDen(game, channelId) {
    game.storytellerDenChannelId = channelId
  }

  unregisterStorytellerDen(game) {
    game.storytellerDenChannelId = null
  }

  registerTownsquare(game, channelId) {
    game.townsquareChannelId = channelId
  }

  unregisterTownsquare(game) {
    game.townsquareChannelId = null
  }

  registerPublicDaySideChannel(game, name, channelId) {
    game.publicDaySideChannelIds ??= {}
    game.publicDaySideChannelIds[name] = channelId
  }

  unregisterPublicDaySideChannel(game, name) {
    if (game.publicDaySideChannelIds) delete game.publicDaySideChannelIds[name]
  }

  registerPrivateConversationCreator(game, channelId) {
    game.privateConversationCreatorChannelId = channelId
  }

  unregisterPrivateConversationCreator(game) {
    game.privateConversationCreatorChannelId = null
  }

  registerPlayerMadeVoiceChannel(game, playerId, channelId) {
    game.playerMadeVoiceChannels ??= {}
    game.playerMadeVoiceChannels[playerId] = channelId
  }

  unregisterPlayerMadeVoiceChannel(game, playerId) {
    if (game.playerMadeVoiceChannels) delete game.playerMadeVoiceChannels[playerId]
  }
}

module.exports = ChannelRegistryService