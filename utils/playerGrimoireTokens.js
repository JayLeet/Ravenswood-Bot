const {
  REMINDER_TOKENS
} = require('./storytellerDashboard/reminderTokens')

const EMPTY_TOKEN = '—'
const TOKEN_EMOJI_BY_TYPE = new Map(REMINDER_TOKENS.map(([type, label]) => [type, getFirstToken(label)]))

function normalizePlayerReminderTokens(tokens = []) {
  const allowed = new Set(REMINDER_TOKENS.map(([type]) => type))
  return [...new Set(Array.isArray(tokens) ? tokens : [])]
    .map(type => String(type || '').trim())
    .filter(type => allowed.has(type))
}

function getPlayerReminderTokenEmojiStack(note = {}) {
  const tokens = normalizePlayerReminderTokens(note.tokens)
    .map(type => TOKEN_EMOJI_BY_TYPE.get(type))
    .filter(Boolean)
  return tokens.length ? tokens.join('/') : EMPTY_TOKEN
}

function createPlayerReminderTokenOptions(selectedTokens = []) {
  const selected = new Set(normalizePlayerReminderTokens(selectedTokens))
  return REMINDER_TOKENS.map(([type, label]) => ({
    label: stripFirstToken(label).slice(0, 100),
    value: type,
    emoji: TOKEN_EMOJI_BY_TYPE.get(type),
    default: selected.has(type)
  }))
}

function getFirstToken(label) {
  return String(label || '').split(' ')[0] || EMPTY_TOKEN
}

function stripFirstToken(label) {
  return String(label || '').split(' ').slice(1).join(' ') || String(label || '')
}

module.exports = {
  createPlayerReminderTokenOptions,
  getPlayerReminderTokenEmojiStack,
  normalizePlayerReminderTokens
}
