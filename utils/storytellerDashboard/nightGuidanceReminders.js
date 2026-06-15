const REMINDER_EMOJIS = Object.freeze({
  custom: '📝',
  dead: '💀',
  drunk: '🍺',
  evil_twin: '👥',
  marked: '📍',
  poisoned: '☠️',
  protected: '🛡️',
  red_herring: '🔴',
  safe: '✅'
})

function createReminderSummary(view, playerId) {
  const reminders = getActiveReminders(view, playerId)
  return {
    tokens: reminders.map(formatReminderToken),
    warnings: createStatusWarnings(view, playerId, reminders)
  }
}

function getActiveReminders(view, playerId) {
  return (view.engine?.reminders || [])
    .filter(reminder => reminder.playerId === playerId)
    .filter(reminder => reminder.status !== 'triggered')
}

function formatReminderToken(reminder) {
  return REMINDER_EMOJIS[reminder.type] || '🔖'
}

function createStatusWarnings(view, playerId, reminders = getActiveReminders(view, playerId)) {
  const activeTypes = new Set(reminders.map(reminder => reminder.type).filter(Boolean))
  const statuses = view.engine?.statusEffects?.[playerId] || {}
  const warnings = []

  if (statuses.drunk || activeTypes.has('drunk')) warnings.push('⚠️ This player is drunk.')
  if (statuses.poisoned || activeTypes.has('poisoned')) warnings.push('⚠️ This player is poisoned.')
  return warnings
}

module.exports = {
  createReminderSummary,
  createStatusWarnings,
  getActiveReminders
}
