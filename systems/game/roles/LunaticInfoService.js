const {
  resetLunaticInfo,
  setLunaticDemonRole,
  toggleLunaticMinion
} = require('../../../utils/lunaticInfo')

class LunaticInfoService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  async resetInfo(manager, guildId, member, playerId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    if (game.roles?.[playerId] !== 'lunatic') return this.notLunatic(manager)

    const info = resetLunaticInfo(game, playerId, manager.scripts)
    return this.saveAndReturn(manager, game, guildId, member, playerId, info)
  }

  async setDemonRole(manager, guildId, member, playerId, demonRoleId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    if (game.roles?.[playerId] !== 'lunatic') return this.notLunatic(manager)
    if (manager.scripts.getRole(game.scriptId, demonRoleId)?.team !== 'demon') {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Choose a Demon from the current script.')
    }

    const info = setLunaticDemonRole(game, playerId, demonRoleId, manager.scripts)
    return this.saveAndReturn(manager, game, guildId, member, playerId, info)
  }

  async toggleMinion(manager, guildId, member, playerId, minionId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    if (game.roles?.[playerId] !== 'lunatic') return this.notLunatic(manager)
    if (!minionId || minionId === playerId || game.users?.[minionId]?.role !== 'player') {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Choose another active player as a fake Minion.')
    }

    const info = toggleLunaticMinion(game, playerId, minionId, manager.scripts)
    return this.saveAndReturn(manager, game, guildId, member, playerId, info)
  }

  notLunatic(manager) {
    return manager.createError(this.errorTypes.INVALID_STATE, 'Select a player whose real role is Lunatic first.')
  }

  async saveAndReturn(manager, game, guildId, member, playerId, info) {
    await manager.emit('LUNATIC_INFO_CHANGED', { game, member, playerId, info })
    manager.save()

    return manager.createSuccess({
      lunaticInfo: info,
      playerId,
      view: manager.serializeGame(game, { guildId })
    })
  }
}

module.exports = LunaticInfoService
