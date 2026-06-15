const PLAYER_GRIMOIRE_NAME_LIMIT = 10
const NAME_EMOJI_SEPARATOR = '\u00A0'

function formatPlayerNameWithEmoji(name, emoji) {
  const displayName = keepTogether(truncatePlayerName(name))
  return `${displayName}${emoji ? `${NAME_EMOJI_SEPARATOR}${emoji}` : ''}`.trim()
}

function truncatePlayerName(name) {
  const text = String(name || '')
  return text.length <= PLAYER_GRIMOIRE_NAME_LIMIT
    ? text
    : `${text.slice(0, PLAYER_GRIMOIRE_NAME_LIMIT - 1)}…`
}

function keepTogether(value) {
  return String(value || '').replace(/\s+/g, NAME_EMOJI_SEPARATOR)
}

module.exports = {
  NAME_EMOJI_SEPARATOR,
  PLAYER_GRIMOIRE_NAME_LIMIT,
  formatPlayerNameWithEmoji,
  keepTogether,
  truncatePlayerName
}