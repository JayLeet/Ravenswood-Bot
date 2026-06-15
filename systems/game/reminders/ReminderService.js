const GRIM_REMINDERS = {
  dead: 'Dead',
  poisoned: 'Poisoned',
  drunk: 'Drunk',
  protected: 'Protected',
  evil_twin: 'Evil Twin',
  red_herring: 'Red Herring',
  marked: 'Marked',
  safe: 'Safe',
  custom: 'Custom'
}

class ReminderService {
  normalizeReminders(game, playerIds, fallbackLabel = type => type) {
    const allowed = new Set(playerIds)

    game.reminders = (game.reminders || []).filter(reminder => {
      if (!allowed.has(reminder.playerId)) return false
      reminder.type = this.normalizeType(reminder.type || 'custom')
      reminder.label ??= GRIM_REMINDERS[reminder.type] || fallbackLabel(reminder.type)
      reminder.text ??= reminder.body || reminder.label
      reminder.status ??= 'active'
      reminder.createdAt ??= Date.now()
      return true
    })
  }

  normalizeType(type) {
    const normalized = String(type || 'custom')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return GRIM_REMINDERS[normalized] ? normalized : 'custom'
  }

  setPlayerStatus(game, playerId, status, active, actorId) {
    const reminderType = this.normalizeType(status)
    if (reminderType === 'custom') {
      return { ok: false, status: reminderType }
    }

    game.statusEffects ??= {}
    game.statusEffects[playerId] ??= {}

    if (active) {
      game.statusEffects[playerId][reminderType] = true
      this.upsertActiveReminder(game, playerId, reminderType, actorId)
    } else {
      delete game.statusEffects[playerId][reminderType]
      this.clearActiveReminder(game, playerId, reminderType, actorId)
    }

    if (Object.keys(game.statusEffects[playerId]).length === 0) {
      delete game.statusEffects[playerId]
    }

    return {
      ok: true,
      status: reminderType,
      active
    }
  }

  clearPlayerStatus(game, playerId, actorId) {
    game.statusEffects ??= {}
    delete game.statusEffects[playerId]
    this.clearActiveRemindersForPlayer(game, playerId, actorId)
  }

  createCustomReminder(game, guildId, playerId, text, createdBy) {
    const body = String(text || '').trim()
    const reminder = {
      id: `${Date.now()}-${playerId}`,
      guildId,
      playerId,
      type: 'custom',
      label: 'Custom',
      text: body,
      body,
      status: 'active',
      createdAt: Date.now(),
      createdBy
    }

    game.reminders ??= []
    game.reminders.push(reminder)
    return reminder
  }

  triggerReminder(game, playerId, triggeredBy) {
    const reminder = [...(game.reminders || [])]
      .reverse()
      .find(item =>
        item.playerId === playerId &&
        item.status !== 'triggered'
      )

    if (!reminder) {
      return { ok: false, reminder: null }
    }

    reminder.status = 'triggered'
    reminder.triggeredAt = Date.now()
    reminder.triggeredBy = triggeredBy

    if (reminder.type && reminder.type !== 'custom') {
      delete game.statusEffects?.[playerId]?.[reminder.type]
      if (game.statusEffects?.[playerId] && Object.keys(game.statusEffects[playerId]).length === 0) {
        delete game.statusEffects[playerId]
      }
    }

    return {
      ok: true,
      reminder
    }
  }

  upsertActiveReminder(game, playerId, type, createdBy) {
    game.reminders ??= []

    const existing = game.reminders.find(reminder =>
      reminder.playerId === playerId &&
      reminder.type === type &&
      reminder.status !== 'triggered'
    )

    if (existing) return existing

    const reminder = {
      id: `${Date.now()}-${type}-${playerId}`,
      guildId: game.guildId,
      playerId,
      type,
      label: GRIM_REMINDERS[type],
      text: GRIM_REMINDERS[type],
      body: GRIM_REMINDERS[type],
      status: 'active',
      createdAt: Date.now(),
      createdBy
    }

    game.reminders.push(reminder)
    return reminder
  }

  clearActiveReminder(game, playerId, type, triggeredBy) {
    const reminder = [...(game.reminders || [])]
      .reverse()
      .find(item =>
        item.playerId === playerId &&
        item.type === type &&
        item.status !== 'triggered'
      )

    if (!reminder) return null

    reminder.status = 'triggered'
    reminder.triggeredAt = Date.now()
    reminder.triggeredBy = triggeredBy
    return reminder
  }

  clearActiveRemindersForPlayer(game, playerId, triggeredBy) {
    for (const reminder of game.reminders || []) {
      if (reminder.playerId !== playerId) continue
      if (reminder.status === 'triggered') continue
      if (reminder.type === 'custom') continue

      reminder.status = 'triggered'
      reminder.triggeredAt = Date.now()
      reminder.triggeredBy = triggeredBy
    }
  }

  async setPlayerStatusForPlayer(manager, guildId, member, playerId, status, active = true) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const statusResult = this.setPlayerStatus(game, playerId, status, active, member.id)
    if (!statusResult.ok) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Unknown Grim reminder')
    }

    await manager.emit('PLAYER_STATUS_CHANGED', {
      game,
      member,
      playerId,
      status: statusResult.status,
      active: statusResult.active
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      status: statusResult.status,
      active: statusResult.active,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async clearPlayerStatusForPlayer(manager, guildId, member, playerId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled

    this.clearPlayerStatus(game, playerId, member.id)

    await manager.emit('PLAYER_STATUS_CHANGED', {
      game,
      member,
      playerId,
      status: null,
      active: false
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async addReminderForPlayer(manager, guildId, member, playerId, text) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const reminder = this.createCustomReminder(game, guildId, playerId, text, member.id)

    await manager.emit('REMINDER_CHANGED', {
      game,
      member,
      playerId,
      reminder,
      action: 'created'
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      reminder,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async triggerReminderForPlayer(manager, guildId, member, playerId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const triggered = this.triggerReminder(game, playerId, member.id)

    if (!triggered.ok) {
      return manager.createError(manager.errorTypes.NOT_FOUND, 'No active reminder for that player')
    }

    const { reminder } = triggered

    await manager.emit('REMINDER_CHANGED', {
      game,
      member,
      playerId,
      reminder,
      action: 'triggered'
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      reminder,
      view: manager.serializeGame(game, { guildId })
    })
  }
}

module.exports = ReminderService
