const BUTTON_EMOJIS = Object.freeze({
  'Add note': '\u{1F4DD}',
  Accept: '\u{2705}',
  Approve: '\u{2705}',
  'Approve Nomination': '\u{2705}',
  'Assign Role': '\u{1F3AD}',
  'Assign Roles': '\u{1F3AD}',
  'Auto Lunatic Info': '\u{1F504}',
  Back: '\u{2B05}\u{FE0F}',
  Cancel: '\u{274C}',
  'Cancel Nomination': '\u{274C}',
  'Cancel Vote': '\u{274C}',
  'Choose What Drunk Sees': '\u{1F37A}',
  Close: '\u{1F6AA}',
  'Confirm Nomination': '\u{2705}',
  'Clear Block': '\u{1F9F9}',
  'Clear role': '\u{1F9F9}',
  'Clear Role': '\u{1F9F9}',
  'Clear status': '\u{1F9F9}',
  'Copy Grimoire': '\u{1F4CB}',
  Custom: '\u{270D}\u{FE0F}',
  'Delete note': '\u{1F5D1}\u{FE0F}',
  Demon: '\u{1F525}',
  'Edit note': '\u{1F4DD}',
  'End Game': '\u{1F3C1}',
  Evil: '\u{1F608}',
  'Evil Won': '\u{1F525}',
  Gong: '\u{1F514}',
  Good: '\u{1F607}',
  'Good Won': '\u{1F499}',
  'Got it': '\u{1F44D}',
  Help: '\u{1F4DA}',
  Kill: '\u{1F480}',
  'Lower your hand': '\u{1F447}',
  'Desktop view': '\u{1F5A5}\uFE0F',
  'Mobile view': '\u{1F4F1}',
  Move: '\u{1F50A}',
  Minions: '\u{1F40D}',
  'Night Order': '\u{1F319}',
  Next: '\u{27A1}\u{FE0F}',
  'Next Phase': '\u{23ED}\u{FE0F}',
  'Next Player': '\u{27A1}\u{FE0F}',
  No: '\u{274C}',
  Nominate: '\u{1F5E3}\u{FE0F}',
  'Open to All Players': '\u{1F50A}',
  Pertinence: '\u{1F5E3}',
  Pause: '\u{23F8}\u{FE0F}',
  Player: '\u{1F464}',
  'Player Controls': '\u{1F39B}\u{FE0F}',
  Previous: '\u{2B05}\u{FE0F}',
  'Raise your hand': '\u{270B}',
  Randomize: '\u{1F3B2}',
  Refresh: '\u{1F504}',
  Reject: '\u{274C}',
  Resume: '\u{25B6}\u{FE0F}',
  'Request Storyteller': '\u{1F4E8}',
  'Reminder Tokens': '\u{1F3F7}\u{FE0F}',
  Requests: '\u{1F4E8}',
  'Restart Vote': '\u{1F501}',
  'Resume Vote': '\u{25B6}\u{FE0F}',
  Revive: '\u{1F49A}',
  'Run Vote': '\u{1F5F3}\u{FE0F}',
  'Set Threshold': '\u{1F4CF}',
  'Start Game': '\u{1F3AC}',
  'Stop Night Order': '\u{1F6D1}',
  'Storyteller Den': '\u{1F3DA}\u{FE0F}',
  Timer: '\u{23F2}\u{FE0F}',
  Wake: '\u{1F319}',
  'View Entire Grim': '\u{1F52E}',
  'View Grimoire': '\u{1F52E}',
  'Voting History': '\u{1F4DC}',
  Yes: '\u{2705}',
  'Yes, start night order': '\u{2705}'
})

const PREFIX_EMOJIS = Object.freeze([
  ['Back to Random Roles', '\u{2B05}\u{FE0F}'],
  ['Confirm Random Roles', '\u{2705}'],
  ['Mark ', '\u{1F3F7}\u{FE0F}'],
  ['Open vote', '\u{1F5F3}\u{FE0F}'],
  ['Quick info', '\u{26A1}'],
  ['Randomize Roles', '\u{1F3B2}'],
  ['Remove ', '\u{2796}'],
  ['Request', '\u{1F4E8}'],
  ['Resolve ', '\u{2705}'],
  ['Send or edit info', '\u{270D}\u{FE0F}'],
  ['Set Speed', '\u{23F1}\u{FE0F}'],
  ['Trigger ', '\u{23F0}'],
  ['Vote closed', '\u{1F512}'],
  ['Wake player', '\u{1F319}']
])

function applyButtonEmoji(button, label) {
  const emoji = resolveButtonEmoji(label)
  if (emoji) button.setEmoji(emoji)
  return button
}

function resolveButtonEmoji(label, customId = null) {
  const emoji = getButtonEmoji(label)
  if (emoji) return emoji

  const id = String(customId || '')
  if (id.includes(':move-player:')) return BUTTON_EMOJIS.Move
  if (id.includes(':grimoire:player:')) return BUTTON_EMOJIS.Player
  if (id.includes(':night-action:player:')) return BUTTON_EMOJIS.Player
  if (id.includes(':night-action:role:')) return BUTTON_EMOJIS['Assign Role']
  return null
}

function getButtonEmoji(label) {
  const text = String(label || '').trim()
  if (!text) return null
  if (BUTTON_EMOJIS[text]) return BUTTON_EMOJIS[text]
  if (/^\(\d+\) Requests$/.test(text)) return BUTTON_EMOJIS.Requests

  const match = PREFIX_EMOJIS.find(([prefix]) => text.startsWith(prefix))
  return match?.[1] || null
}

module.exports = {
  applyButtonEmoji,
  getButtonEmoji,
  resolveButtonEmoji
}
