const {
  formatPlainText
} = require('./gameLogTextFormat')

function formatChatLog(summary) {
  const messages = Array.isArray(summary?.chatMessages) ? summary.chatMessages : []
  if (!messages.length) return 'No chat messages recorded.'

  const lines = []
  const dropped = Number(summary.chatMessagesDropped) || 0
  if (dropped > 0) {
    lines.push(`Skipped ${dropped} older chat message${dropped === 1 ? '' : 's'} because the game-log cap was reached.`)
    lines.push('')
  }

  let currentPhase = null
  let currentChannel = null
  for (const message of [...messages].sort(compareChatMessages)) {
    const phase = formatChatPhase(message)
    const channel = formatChatChannel(message)
    if (phase !== currentPhase) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      lines.push(phase)
      currentPhase = phase
      currentChannel = null
    }
    if (channel !== currentChannel) {
      lines.push(`${channel}:`)
      currentChannel = channel
    }
    lines.push(`${formatChatTime(message)} ${formatAuthor(message)}: ${formatContent(summary, message)}`)
  }

  return lines.join('\n')
}

function compareChatMessages(left, right) {
  return (Number(left?.timestamp) || 0) - (Number(right?.timestamp) || 0)
}

function formatChatTime(message) {
  const timestamp = Number(message.timestamp)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '[unknown time]'
  return `[${new Date(timestamp).toISOString().slice(11, 19)} UTC]`
}

function formatChatPhase(message) {
  if (message.phaseLabel) return message.phaseLabel
  if (message.phase === 'post-game') return 'Post-game chat'
  if (message.phase === 'lobby') return 'Pre-game chat'
  if (message.phase === 'night') return `Night ${message.day || '?'}`
  if (message.phase) return `Day ${message.day || '?'}`
  return 'Game chat'
}

function formatChatChannel(message) {
  return message.channelName || message.channelId || 'unknown-channel'
}

function formatAuthor(message) {
  return message.displayName || 'Unknown user'
}

function formatContent(summary, message) {
  const parts = []
  const content = formatPlainText(summary, message.content || '')
  if (content) parts.push(content)

  for (const attachment of message.attachments || []) {
    const name = attachment.name || 'attachment'
    const url = attachment.url ? ` ${attachment.url}` : ''
    parts.push(`[attachment: ${name}${url}]`)
  }

  for (const sticker of message.stickers || []) {
    parts.push(`[sticker: ${sticker.name || 'sticker'}]`)
  }

  return parts.join(' ') || '[empty message]'
}

module.exports = {
  formatChatLog
}
