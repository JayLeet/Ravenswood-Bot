const {
  createPlayerSeatingMapFields
} = require('../playerGrimoireSeatingMap')
const {
  REMINDER_TOKENS
} = require('./reminderTokens')

const TOKEN_TYPES = new Set(REMINDER_TOKENS.map(([type]) => type))

function createStorytellerSeatingMapFields(view, playerLabels = {}) {
  return createPlayerSeatingMapFields(
    view,
    null,
    createActualGrimoireNotes(view),
    playerLabels
  )
}

function createActualGrimoireNotes(view) {
  return Object.fromEntries((view?.users?.players || []).map(playerId => [
    playerId,
    {
      roleId: view?.engine?.roles?.[playerId] || null,
      note: '',
      tokens: getActiveTokenTypes(view, playerId)
    }
  ]))
}

function getActiveTokenTypes(view, playerId) {
  const types = new Set()
  const effects = view?.engine?.statusEffects?.[playerId] || {}
  for (const [type, active] of Object.entries(effects)) {
    if (active && TOKEN_TYPES.has(type)) types.add(type)
  }

  for (const reminder of getReminderRecords(view)) {
    if (reminder.playerId === playerId && reminder.status !== 'triggered' && TOKEN_TYPES.has(reminder.type)) {
      types.add(reminder.type)
    }
  }

  return [...types]
}

function getReminderRecords(view) {
  const reminders = view?.engine?.reminders || []
  if (Array.isArray(reminders)) return reminders
  return Object.values(reminders).flatMap(value => Array.isArray(value) ? value : [value])
}

module.exports = {
  createStorytellerSeatingMapFields
}
