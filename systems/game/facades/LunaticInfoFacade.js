module.exports = {
  async resetLunaticInfo(guildId, member, playerId) {
    return this.lunaticInfo.resetInfo(this, guildId, member, playerId)
  },

  async setLunaticDemonRole(guildId, member, playerId, demonRoleId) {
    return this.lunaticInfo.setDemonRole(this, guildId, member, playerId, demonRoleId)
  },

  async toggleLunaticMinion(guildId, member, playerId, minionId) {
    return this.lunaticInfo.toggleMinion(this, guildId, member, playerId, minionId)
  }
}
