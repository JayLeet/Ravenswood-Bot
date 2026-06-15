const {
  normalizePlayerReminderTokens
} = require('../../../utils/playerGrimoireTokens')

class PlayerGrimoireService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  getNotes(game, ownerId) {
    return normalizeOwnerNotes(game.playerGrimoires?.[ownerId] || {})
  }

  setGuess(manager, guildId, member, targetId, roleId) {
    const ready = this.validateRequest(manager, guildId, member, targetId)
    if (!ready.ok) return ready
    const { game, ownerId } = ready

    const normalizedRoleId = String(roleId || '').trim()
    if (!normalizedRoleId) return this.clearGuess(manager, game, guildId, ownerId, targetId)

    const role = manager.scripts.getRole(game.scriptId, normalizedRoleId)
    if (!role) return manager.createError(this.errorTypes.INVALID_STATE, 'Choose a character on the current script')

    game.playerGrimoires ??= {}
    game.playerGrimoires[ownerId] ??= {}
    const existing = normalizeTargetNote(game.playerGrimoires[ownerId][targetId])
    game.playerGrimoires[ownerId][targetId] = {
      ...existing,
      roleId: normalizedRoleId
    }
    manager.save()

    return manager.createSuccess({
      ownerId,
      targetId,
      roleId: normalizedRoleId,
      roleName: role.name,
      view: manager.serializeGame(game, { guildId })
    })
  }

  clearGuess(manager, game, guildId, ownerId, targetId) {
    this.updateTargetNote(game, ownerId, targetId, { roleId: null })

    manager.save()
    return manager.createSuccess({
      ownerId,
      targetId,
      roleId: null,
      view: manager.serializeGame(game, { guildId })
    })
  }

  setNote(manager, guildId, member, targetId, note) {
    const ready = this.validateRequest(manager, guildId, member, targetId)
    if (!ready.ok) return ready
    const { game, ownerId } = ready

    const normalizedNote = normalizeNoteText(note)
    this.updateTargetNote(game, ownerId, targetId, { note: normalizedNote })
    manager.save()

    return manager.createSuccess({
      ownerId,
      targetId,
      note: normalizedNote,
      view: manager.serializeGame(game, { guildId })
    })
  }

  setTokens(manager, guildId, member, targetId, tokens = []) {
    const ready = this.validateRequest(manager, guildId, member, targetId)
    if (!ready.ok) return ready
    const { game, ownerId } = ready

    const normalizedTokens = normalizePlayerReminderTokens(tokens)
    this.updateTargetNote(game, ownerId, targetId, { tokens: normalizedTokens })
    manager.save()

    return manager.createSuccess({
      ownerId,
      targetId,
      tokens: normalizedTokens,
      view: manager.serializeGame(game, { guildId })
    })
  }

  clearNote(manager, guildId, member, targetId) {
    return this.setNote(manager, guildId, member, targetId, '')
  }

  updateTargetNote(game, ownerId, targetId, patch) {
    const existing = normalizeTargetNote(game.playerGrimoires?.[ownerId]?.[targetId])
    const next = {
      ...existing,
      ...patch
    }

    if (!next.roleId && !next.note && !next.tokens.length) {
      if (game.playerGrimoires?.[ownerId]) {
        delete game.playerGrimoires[ownerId][targetId]
        if (!Object.keys(game.playerGrimoires[ownerId]).length) delete game.playerGrimoires[ownerId]
      }
      return
    }

    game.playerGrimoires ??= {}
    game.playerGrimoires[ownerId] ??= {}
    game.playerGrimoires[ownerId][targetId] = next
  }

  validateRequest(manager, guildId, member, targetId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    const ownerId = member.id
    const owner = this.validatePlayer(manager, game, ownerId, 'Only players can use a personal grimoire')
    if (!owner.ok) return owner

    const target = this.validatePlayer(manager, game, targetId, 'Choose a player in this game')
    if (!target.ok) return target

    return manager.createSuccess({ game, ownerId })
  }

  validatePlayer(manager, game, userId, message) {
    if (manager.getRole(game, userId) !== 'player') {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, message)
    }

    return manager.createSuccess()
  }
}

function normalizeOwnerNotes(notes) {
  return Object.fromEntries(
    Object.entries(notes || {}).map(([targetId, note]) => [targetId, normalizeTargetNote(note)])
  )
}

function normalizeTargetNote(note) {
  if (typeof note === 'string') return { roleId: note || null, note: '', tokens: [] }
  return {
    roleId: note?.roleId || null,
    note: normalizeNoteText(note?.note || ''),
    tokens: normalizePlayerReminderTokens(note?.tokens || [])
  }
}

function normalizeNoteText(note) {
  return String(note || '').trim().slice(0, 1000)
}

module.exports = PlayerGrimoireService