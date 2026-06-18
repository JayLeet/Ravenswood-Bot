const {
  formatPlainUser,
  isFakeUserId
} = require('./gameLogTextFormat')

function formatUserIds(summary, savedById = null) {
  return [
    'For moderation/reference only.',
    formatIdLine('Storyteller', summary.storytellerId, summary),
    savedById ? formatIdLine('Saved by', savedById, summary) : null,
    formatIdGroup('Players', summary.players, summary),
    formatIdGroup('Spectators', summary.spectators, summary),
    formatIdGroup('Chat authors', getChatOnlyAuthorIds(summary, savedById), createChatDisplaySummary(summary))
  ].filter(Boolean).join('\n')
}

function formatIdGroup(title, ids = [], summary) {
  if (!ids.length) return null
  return [
    `${title}:`,
    ...ids.map(userId => `- ${formatIdLabel(userId, summary)}`)
  ].join('\n')
}

function formatIdLine(label, userId, summary) {
  return userId ? `${label} - ${formatIdLabel(userId, summary)}` : null
}

function formatIdLabel(userId, summary) {
  const idLabel = isFakeUserId(userId) ? 'test player id' : 'user id'
  return `${formatPlainUser(summary, userId)} - ${idLabel}: ${userId}`
}

function getChatOnlyAuthorIds(summary, savedById) {
  const known = new Set([
    summary.storytellerId,
    savedById,
    ...(summary.players || []),
    ...(summary.spectators || [])
  ].filter(Boolean))
  return [...new Set((summary.chatMessages || [])
    .map(message => message.authorId)
    .filter(Boolean))]
    .filter(userId => !known.has(userId))
}

function createChatDisplaySummary(summary) {
  const displayNames = { ...(summary.displayNames || {}) }
  for (const message of summary.chatMessages || []) {
    if (message.authorId && message.displayName) displayNames[message.authorId] = message.displayName
  }
  return { ...summary, displayNames }
}

module.exports = {
  formatUserIds
}
