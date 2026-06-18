const {
  getRoleName
} = require('../roleFormatting')
const {
  normalizeGrimoirePlayerName
} = require('../playerGrimoireDisplay')
const {
  REMINDER_TOKENS
} = require('./reminderTokens')
const {
  getRoleEmoji,
  getRoleTeam
} = require('./roleEmojis')

const FIELD_LIMIT = 1000
const TOKEN_TYPES = new Set(REMINDER_TOKENS.map(([type]) => type))

function createMobileGrimoireFields(view, playerLabels = {}) {
  const lines = (view?.users?.players || [])
    .filter(Boolean)
    .map((playerId, index) => formatMobileGrimoireLine(view, playerId, index, playerLabels))

  return chunkLines('Seating order', lines)
}

function formatMobileGrimoireLine(view, playerId, index, playerLabels = {}) {
  return [
    `${index + 1}. ${getPlayerLabel(view, playerLabels, playerId)}`,
    formatMobileRole(view, playerId),
    getAlignmentLabel(view, playerId),
    getLifeState(view, playerId),
    getActiveTokenEmojiLine(view, playerId)
  ].filter(Boolean).join(' - ')
}

function formatMobileRole(view, playerId) {
  const roleId = view?.engine?.roles?.[playerId]
  if (!roleId) return '❔ Unassigned'

  const role = `${getRoleEmoji(view, roleId)} ${getRoleName(view, roleId)}`
  const shownRoleId = view?.engine?.shownRoles?.[playerId]
  if (roleId === 'drunk' && shownRoleId) {
    return `${role} (sees ${getRoleEmoji(view, shownRoleId)} ${getRoleName(view, shownRoleId)})`
  }
  return role
}

function getAlignmentLabel(view, playerId) {
  const roleId = view?.engine?.roles?.[playerId]
  const team = getRoleTeam(view, roleId)
  if (team === 'townsfolk' || team === 'outsider') return 'Good'
  if (team === 'minion' || team === 'demon') return 'Evil'
  return 'Unknown'
}

function getLifeState(view, playerId) {
  return (view?.users?.deadPlayers || []).includes(playerId) ? 'Dead' : 'Alive'
}

function getActiveTokenEmojiLine(view, playerId) {
  const tokens = getActiveTokenTypes(view, playerId)
    .map(type => REMINDER_TOKENS.find(([tokenType]) => tokenType === type)?.[1])
    .map(label => String(label || '').split(' ')[0])
    .filter(Boolean)

  return tokens.length ? tokens.join(' ') : null
}

function getActiveTokenTypes(view, playerId) {
  const types = new Set()
  const effects = view?.engine?.statusEffects?.[playerId] || {}

  for (const [type, active] of Object.entries(effects)) {
    if (active && TOKEN_TYPES.has(type)) types.add(type)
  }

  for (const reminder of getReminderRecords(view)) {
    if (reminder.playerId !== playerId) continue
    if (reminder.status === 'triggered') continue
    if (TOKEN_TYPES.has(reminder.type)) types.add(reminder.type)
  }

  return [...types]
}

function getReminderRecords(view) {
  const reminders = view?.engine?.reminders || []
  if (Array.isArray(reminders)) return reminders
  return Object.values(reminders).flatMap(value => Array.isArray(value) ? value : [value])
}

function getPlayerLabel(view, playerLabels, playerId) {
  return normalizeGrimoirePlayerName(
    playerLabels[playerId] || view?.users?.displayNames?.[playerId] || `Player ${String(playerId).slice(-4)}`
  )
}

function chunkLines(baseName, lines) {
  const fields = []
  let current = []
  let length = 0

  for (const line of lines) {
    const nextLength = length + line.length + 1
    if (current.length && nextLength > FIELD_LIMIT) {
      fields.push(createField(baseName, fields.length, current))
      current = []
      length = 0
    }
    current.push(line)
    length += line.length + 1
  }

  if (current.length) fields.push(createField(baseName, fields.length, current))
  return fields
}

function createField(baseName, index, lines) {
  return {
    name: index === 0 ? baseName : `${baseName} ${index + 1}`,
    value: lines.join('\n'),
    inline: false
  }
}

module.exports = {
  createMobileGrimoireFields,
  formatMobileGrimoireLine
}
