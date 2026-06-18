const {
  createPrivateVoiceNoticeRow
} = require('./privateVoiceRequests')

function createPrivateVoiceFeatureNotice(phase) {
  if (phase !== 'day') return null
  return [
    '🔒 Private voice',
    'Use `/voicechat player:<player>`, press Start Private Voice, or join `🕯️ Create Private Voice`.',
    '',
    '📨 Invite to Room',
    'Already inside a bot-made room? Use `/invite player:<player>` or press Invite to Room.'
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
