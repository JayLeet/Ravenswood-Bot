const {
  createPrivateVoiceNoticeRow
} = require('./privateVoiceRequests')

function createPrivateVoiceFeatureNotice(phase) {
  if (phase !== 'day') return null
  return [
    'Private voice chats are available now.',
    'Start one with `/voicechat player:<player>` or join `🕯️ Create Private Voice`.',
    'Already inside a private room? Use `/invite player:<player>` to bring in another player.'
  ].join('\n')
}

function appendPrivateVoiceFeatureNotice(message, phase) {
  const notice = createPrivateVoiceFeatureNotice(phase)
  if (!notice) return message || null
  return [message, notice].filter(Boolean).join('\n\n')
}

function createPrivateVoiceFeatureComponents(phase) {
  return phase === 'day' ? [createPrivateVoiceNoticeRow()] : []
}

module.exports = {
  appendPrivateVoiceFeatureNotice,
  createPrivateVoiceFeatureComponents,
  createPrivateVoiceFeatureNotice
}
