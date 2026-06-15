class ScriptSelectionService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  async setScript(manager, guildId, member, scriptId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Not storyteller')
    }

    if (game.state !== 'lobby') {
      return manager.createError(
        this.errorTypes.INVALID_STATE,
        'The script can only be changed before the game starts'
      )
    }

    const normalizedScriptId = manager.scripts.normalizeScriptId(scriptId)
    const script = normalizedScriptId ? manager.scripts.getScript(normalizedScriptId) : null

    if (!script) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Unknown script')
    }

    game.scriptId = script.id
    game.script = script.name
    game.roleCategories = manager.createDefaultRoleCategories(script.id)
    manager.removeRolesOutsideScript(game)

    await manager.emit('SCRIPT_CHANGED', {
      game,
      member,
      script
    })

    manager.save()

    return manager.createSuccess({
      script,
      view: manager.serializeGame(game, { guildId })
    })
  }
}

module.exports = ScriptSelectionService
