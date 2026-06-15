module.exports = {
  getStorytellerControlledPlayer(guildId, member, playerId) {
    return this.roleAssignments.getStorytellerControlledPlayer(this, guildId, member, playerId)
  },

  getScriptRoleIds(game) {
    return this.roleAssignments.getScriptRoleIds(game)
  },

  formatScriptRole(roleId, scriptId = this.scripts.defaultScriptId) {
    return this.roleAssignments.formatScriptRole(this, roleId, scriptId)
  },

  async assignScriptRole(guildId, member, playerId, roleId) {
    return this.roleAssignments.assignScriptRole(this, guildId, member, playerId, roleId)
  },

  async setDrunkShownRole(guildId, member, playerId, shownRoleId) {
    return this.roleAssignments.setDrunkShownRole(this, guildId, member, playerId, shownRoleId)
  },

  async assignRandomScriptRoles(guildId, member, roleIds, options = {}) {
    return this.roleAssignments.assignRandomScriptRoles(this, guildId, member, roleIds, options)
  },

  async clearScriptRole(guildId, member, playerId) {
    return this.roleAssignments.clearScriptRole(this, guildId, member, playerId)
  },

  async killPlayer(guildId, member, playerId) {
    return this.roleAssignments.killPlayer(this, guildId, member, playerId)
  },

  async assignManualImpReplacement(guildId, member, playerId, requestId) {
    return this.roleAssignments.assignManualImpReplacement(this, guildId, member, playerId, requestId)
  },

  async revivePlayer(guildId, member, playerId) {
    return this.roleAssignments.revivePlayer(this, guildId, member, playerId)
  },

  async setPlayerStatus(guildId, member, playerId, status, active = true) {
    return this.reminders.setPlayerStatusForPlayer(this, guildId, member, playerId, status, active)
  },

  async clearPlayerStatus(guildId, member, playerId) {
    return this.reminders.clearPlayerStatusForPlayer(this, guildId, member, playerId)
  },

  async addReminder(guildId, member, playerId, text) {
    return this.reminders.addReminderForPlayer(this, guildId, member, playerId, text)
  },

  async triggerReminder(guildId, member, playerId) {
    return this.reminders.triggerReminderForPlayer(this, guildId, member, playerId)
  },

  upsertActiveGrimReminder(game, playerId, type, createdBy) {
    return this.reminders.upsertActiveReminder(game, playerId, type, createdBy)
  },

  clearActiveGrimReminder(game, playerId, type, triggeredBy) {
    return this.reminders.clearActiveReminder(game, playerId, type, triggeredBy)
  },

  clearActiveGrimRemindersForPlayer(game, playerId, triggeredBy) {
    this.reminders.clearActiveRemindersForPlayer(game, playerId, triggeredBy)
  },

  async recordPlayerWake(guildId, member, playerId) {
    return this.createNightTargetAction(guildId, member, playerId)
  },

  async recordSecretInfo(guildId, member, playerId) {
    return this.recordStorytellerAction(guildId, member, playerId, 'secret_info')
  },

  async recordStorytellerAction(guildId, member, playerId, type) {
    return this.nightActions.recordStorytellerAction(this, guildId, member, playerId, type)
  },

  async createNightTargetAction(guildId, member, playerId) {
    return this.nightActions.createNightTargetAction(this, guildId, member, playerId)
  },

  setNightActionPrompt(guildId, actionId, channelId, messageId) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')

    const action = this.nightActions.setPrompt(game, actionId, channelId, messageId)
    if (!action) return this.createError(this.errorTypes.NOT_FOUND, 'Night action not found')

    this.save()

    return this.createSuccess({
      action,
      view: this.serializeGame(game, { guildId })
    })
  },

  async submitNightActionTarget(guildId, member, actionId, targetId) {
    return this.nightActions.submitNightActionTarget(this, guildId, member, actionId, targetId)
  },

  async submitNightActionText(guildId, member, actionId, text) {
    return this.nightActions.submitNightActionText(this, guildId, member, actionId, text)
  },

  async resolveLatestNightAction(guildId, member, playerId) {
    return this.nightActions.resolveLatestNightAction(this, guildId, member, playerId)
  },

  async setAlejoRules(guildId, member, enabled) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!this.isStoryteller(game, member.id)) {
      return this.createError(this.errorTypes.PERMISSION_DENIED, 'Only the Storyteller can do that')
    }

    game.nightOptions ??= {}
    game.nightOptions.alejoRules = enabled === true
    game.nightOptions.alejoRulesDecidedAt = Date.now()
    game.nightOptions.alejoRulesDecidedBy = member.id

    await this.emit('NIGHT_RULES_CHANGED', { game, member, alejoRules: game.nightOptions.alejoRules })
    this.save()

    return this.createSuccess({
      view: this.serializeGame(game, { guildId })
    })
  }
}
