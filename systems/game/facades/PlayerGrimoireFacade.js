module.exports = {
  getPlayerGrimoireNotes(guildId, userId) {
    const game = this.get(guildId)
    if (!game) return {}
    return this.playerGrimoires.getNotes(game, userId)
  },

  setPlayerGrimoireGuess(guildId, member, targetId, roleId) {
    return this.playerGrimoires.setGuess(this, guildId, member, targetId, roleId)
  },

  setPlayerGrimoireNote(guildId, member, targetId, note) {
    return this.playerGrimoires.setNote(this, guildId, member, targetId, note)
  },

  setPlayerGrimoireTokens(guildId, member, targetId, tokens) {
    return this.playerGrimoires.setTokens(this, guildId, member, targetId, tokens)
  },

  clearPlayerGrimoireNote(guildId, member, targetId) {
    return this.playerGrimoires.clearNote(this, guildId, member, targetId)
  }
}
