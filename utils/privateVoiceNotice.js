function createPrivateVoiceFeatureNotice(phase) {
  if (phase !== 'day') return null
  return 'Private voice chats are available now. Use `/voicechat player:<player>` or join `🕯️ Create Private Voice`; room creators can invite players or open the room to all players.'
}

function appendPrivateVoiceFeatureNotice(message, phase) {
  const notice = createPrivateVoiceFeatureNotice(phase)
  if (!notice) return message || null
  return [message, notice].filter(Boolean).join('\n\n')
}

module.exports = {
  appendPrivateVoiceFeatureNotice,
  createPrivateVoiceFeatureNotice
}
