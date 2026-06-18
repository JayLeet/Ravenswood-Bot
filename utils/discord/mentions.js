function extractMentions(message) {
  return [...new Set(String(message).match(/<@!?\d+>/g) || [])].join(' ') || undefined
}

module.exports = {
  extractMentions
}
