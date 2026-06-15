module.exports = {
  async cleanupTrackedMessages(guild, game) {
    return this.cleanup.cleanupTrackedMessages(guild, game)
  },

  async cleanupNightChannels(guild, game) {
    return this.cleanup.cleanupNightChannels(guild, game)
  },

  async cleanupNightVoiceChannels(guild, game) {
    return this.cleanup.cleanupNightVoiceChannels(guild, game)
  },

  async cleanupNightChannelMessages(guild, game) {
    return this.cleanup.cleanupNightChannelMessages(guild, game)
  },

  async cleanupPlayerMadeVoiceChannels(guild, game, options = {}) {
    return this.cleanup.cleanupPlayerMadeVoiceChannels(guild, game, options)
  },

  async cleanupStorytellerDen(guild, game) {
    return this.cleanup.cleanupStorytellerDen(guild, game)
  },

  async cleanupTownsquare(guild, game) {
    return this.cleanup.cleanupTownsquare(guild, game)
  },

  async cleanupPublicDaySideChannels(guild, game) {
    return this.cleanup.cleanupPublicDaySideChannels(guild, game)
  },

  async cleanupNightChannelForUser(guild, game, userId) {
    return this.cleanup.cleanupNightChannelForUser(guild, game, userId)
  },

  async cleanupNightVoiceChannelForUser(guild, game, userId) {
    return this.cleanup.cleanupNightVoiceChannelForUser(guild, game, userId)
  },

  async emit(event, payload) {
    return await this.events.emit(event, payload)
  },

  async recoverGameState(guildId) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    const summary = await this.recovery.recoverGame(this, game)

    if (summary.changed) this.save()

    return this.createSuccess({
      game,
      summary,
      view: this.serializeGame(game, { guildId })
    })
  }
}
