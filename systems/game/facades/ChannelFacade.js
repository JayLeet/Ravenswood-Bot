module.exports = {
  registerNightChannel(guildId, playerId, channelId) {
    return this.registerPlayerChannel(guildId, playerId, channelId, 'registerNightChannel')
  },

  unregisterNightChannel(guildId, playerId) {
    return this.unregisterPlayerChannel(guildId, playerId, 'unregisterNightChannel')
  },

  registerNightVoiceChannel(guildId, playerId, channelId) {
    return this.registerPlayerChannel(guildId, playerId, channelId, 'registerNightVoiceChannel')
  },

  unregisterNightVoiceChannel(guildId, playerId) {
    return this.unregisterPlayerChannel(guildId, playerId, 'unregisterNightVoiceChannel')
  },

  registerStorytellerDen(guildId, channelId) {
    return this.registerSingleChannel(guildId, channelId, 'registerStorytellerDen')
  },

  unregisterStorytellerDen(guildId) {
    return this.unregisterSingleChannel(guildId, 'unregisterStorytellerDen')
  },

  registerTownsquare(guildId, channelId) {
    return this.registerSingleChannel(guildId, channelId, 'registerTownsquare')
  },

  unregisterTownsquare(guildId) {
    return this.unregisterSingleChannel(guildId, 'unregisterTownsquare')
  },

  registerPublicDaySideChannel(guildId, name, channelId) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    this.channels.registerPublicDaySideChannel(game, name, channelId)
    this.save()

    return this.createSuccess({
      name,
      channelId,
      view: this.serializeGame(game, { guildId })
    })
  },

  unregisterPublicDaySideChannel(guildId, name) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    this.channels.unregisterPublicDaySideChannel(game, name)
    this.save()

    return this.createSuccess({
      name,
      view: this.serializeGame(game, { guildId })
    })
  },

  registerPrivateConversationCreator(guildId, channelId) {
    return this.registerSingleChannel(guildId, channelId, 'registerPrivateConversationCreator')
  },

  unregisterPrivateConversationCreator(guildId) {
    return this.unregisterSingleChannel(guildId, 'unregisterPrivateConversationCreator')
  },

  registerPlayerMadeVoiceChannel(guildId, playerId, channelId) {
    return this.registerPlayerChannel(guildId, playerId, channelId, 'registerPlayerMadeVoiceChannel')
  },

  unregisterPlayerMadeVoiceChannel(guildId, playerId) {
    return this.unregisterPlayerChannel(guildId, playerId, 'unregisterPlayerMadeVoiceChannel')
  },

  registerPlayerChannel(guildId, playerId, channelId, method) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    if (this.getRole(game, playerId) !== 'player') {
      return this.createError(this.errorTypes.INVALID_STATE, 'That user is not a player')
    }

    this.channels[method](game, playerId, channelId)
    this.save()

    return this.createSuccess({
      playerId,
      channelId,
      view: this.serializeGame(game, { guildId })
    })
  },

  unregisterPlayerChannel(guildId, playerId, method) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    this.channels[method](game, playerId)
    this.save()

    return this.createSuccess({
      playerId,
      view: this.serializeGame(game, { guildId })
    })
  },

  registerSingleChannel(guildId, channelId, method) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    this.channels[method](game, channelId)
    this.save()

    return this.createSuccess({
      channelId,
      view: this.serializeGame(game, { guildId })
    })
  },

  unregisterSingleChannel(guildId, method) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    this.channels[method](game)
    this.save()

    return this.createSuccess({
      view: this.serializeGame(game, { guildId })
    })
  }
}