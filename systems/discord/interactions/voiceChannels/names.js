const { messages } = require('../../../../utils/text/messageRegistry')
const {
  formatCompactTeamCounts
} = require('../../../../utils/teamCounts')

const TOWNSQUARE_VOICE_CHANNEL_NAME = '🏘️ Townsquare'
const NIGHT_COTTAGE_EMOJI = '🌙'
const PUBLIC_DAY_SIDE_ROOM_NAMES = Object.freeze([
  '🌲 Village Outskirts',
  '🪑 Quiet Corner',
  '🍻 Tavern Booth'
])
const PRIVATE_CONVERSATION_CREATOR_CHANNEL_NAME = '🕯️ Create Private Voice'
const LEGACY_TOWNSQUARE_VOICE_CHANNEL_NAMES = Object.freeze([
  'Townsquare - Public Discussion',
  'Townsquare'
])
const LEGACY_PRIVATE_CONVERSATION_CREATOR_NAMES = Object.freeze([
  '🕯️ Whisper Door - join for private chat',
  'Join to Create Private Chat',
  'Private Chat Creator'
])
const PRIVATE_CONVERSATION_THEMES = Object.freeze([
  { emoji: '🕯️', name: 'Whispering Alley' },
  { emoji: '🔮', name: 'Hidden Parlor' },
  { emoji: '🌙', name: 'Moonlit Alcove' },
  { emoji: '🪦', name: 'Graveyard Gate' },
  { emoji: '🎭', name: 'Masked Confessional' },
  { emoji: '📜', name: 'Sealed Grimoire' },
  { emoji: '🗝️', name: 'Secret Passage' },
  { emoji: '🕸️', name: "Spider's Web" },
  { emoji: '⚖️', name: 'Shadow Tribunal' },
  { emoji: '🍷', name: 'Poisoned Cellar' },
  { emoji: '🧵', name: "Fate's Cloister" },
  { emoji: '🦇', name: 'Belfry Hideaway' },
  { emoji: '🔥', name: "Demon's Back Room" },
  { emoji: '🩸', name: 'Scarlet Crypt' },
  { emoji: '🧿', name: "Watcher's Blind" }
])

function createNightVoiceChannelName(member) {
  const fallbackId = member?.id ? `Player ${member.id.slice(-4)}` : 'Player'
  const name = sanitizeVoiceName(member?.displayName || member?.user?.username || fallbackId, fallbackId)
  const cottageName = messages.get('night.voice.cottageName', {
    player: name || fallbackId
  })

  return ensureNightCottageEmoji(cottageName)
}

function createTownsquareVoiceChannelName() {
  return TOWNSQUARE_VOICE_CHANNEL_NAME
}

function createTownsquareVoiceChannelStatus(view = null) {
  const counts = formatCompactTeamCounts(view)
  return counts ? `Setup count: ${counts}` : null
}

function getTownsquareVoiceChannelLookupNames() {
  return [
    TOWNSQUARE_VOICE_CHANNEL_NAME,
    ...LEGACY_TOWNSQUARE_VOICE_CHANNEL_NAMES
  ]
}

function getPublicDaySideRoomNames() {
  return [...PUBLIC_DAY_SIDE_ROOM_NAMES]
}

function createPrivateConversationCreatorChannelName() {
  return PRIVATE_CONVERSATION_CREATOR_CHANNEL_NAME
}

function getPrivateConversationCreatorChannelLookupNames() {
  return [
    PRIVATE_CONVERSATION_CREATOR_CHANNEL_NAME,
    ...LEGACY_PRIVATE_CONVERSATION_CREATOR_NAMES
  ]
}

function createPrivateConversationVoiceChannelName(member, themeIndex = randomPrivateConversationThemeIndex()) {
  const fallbackId = member?.id ? `Player ${member.id.slice(-4)}` : 'Player'
  const playerName = sanitizeVoiceName(member?.displayName || member?.user?.username || fallbackId, fallbackId)
  const theme = PRIVATE_CONVERSATION_THEMES[normalizeThemeIndex(themeIndex)]

  return formatPrivateConversationVoiceChannelName(theme, playerName)
}

function createPrivateConversationVoiceChannelLookupNames(member) {
  const fallbackId = member?.id ? `Player ${member.id.slice(-4)}` : 'Player'
  const playerName = sanitizeVoiceName(member?.displayName || member?.user?.username || fallbackId, fallbackId)

  return PRIVATE_CONVERSATION_THEMES.flatMap(theme => [
    formatPrivateConversationVoiceChannelName(theme, playerName),
    formatLegacyPrivateConversationVoiceChannelName(theme, playerName),
    formatIntermediatePrivateConversationVoiceChannelName(theme, playerName)
  ])
}

function getPrivateConversationThemes() {
  return PRIVATE_CONVERSATION_THEMES.map(theme => ({ ...theme }))
}

function pickUnusedPrivateConversationThemeIndex(usedThemeIndexes = []) {
  const used = new Set(usedThemeIndexes.map(normalizeThemeIndex))
  const available = PRIVATE_CONVERSATION_THEMES
    .map((_, index) => index)
    .filter(index => !used.has(index))

  return randomArrayItem(available.length ? available : PRIVATE_CONVERSATION_THEMES.map((_, index) => index))
}

function getPrivateConversationThemeIndexFromName(name) {
  return PRIVATE_CONVERSATION_THEMES.findIndex(theme =>
    isPrivateConversationThemeName(name, theme)
  )
}

function formatPrivateConversationVoiceChannelName(theme, playerName) {
  return `${theme.emoji} ${possessiveName(playerName)} ${theme.name}`.slice(0, 100)
}

function formatLegacyPrivateConversationVoiceChannelName(theme, playerName) {
  return `${theme.emoji} ${theme.name} - ${playerName}`.slice(0, 100)
}

function formatIntermediatePrivateConversationVoiceChannelName(theme, playerName) {
  return `${theme.emoji} Private ${theme.name} - ${playerName}`.slice(0, 100)
}

function isPrivateConversationThemeName(name, theme) {
  const value = String(name || '')
  return value.includes(`${theme.name}`) && (
    value.startsWith(`${theme.emoji} `) ||
    value.startsWith(`${theme.emoji} Private `)
  )
}

function ensureNightCottageEmoji(name) {
  const value = String(name || '').trim()
  if (!value) return `${NIGHT_COTTAGE_EMOJI} Cottage`
  return value.startsWith(`${NIGHT_COTTAGE_EMOJI} `) ? value : `${NIGHT_COTTAGE_EMOJI} ${value}`
}

function possessiveName(playerName) {
  return String(playerName || 'Player').endsWith('s')
    ? `${playerName}'`
    : `${playerName}'s`
}

function randomPrivateConversationThemeIndex() {
  return Math.floor(Math.random() * PRIVATE_CONVERSATION_THEMES.length)
}

function randomArrayItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function normalizeThemeIndex(themeIndex) {
  const index = Number(themeIndex) || 0
  return Math.abs(index) % PRIVATE_CONVERSATION_THEMES.length
}

function sanitizeVoiceName(value, fallback) {
  return String(value || fallback || 'Player')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70)
}

module.exports = {
  createNightVoiceChannelName,
  createPrivateConversationCreatorChannelName,
  createPrivateConversationVoiceChannelLookupNames,
  createPrivateConversationVoiceChannelName,
  createTownsquareVoiceChannelName,
  createTownsquareVoiceChannelStatus,
  ensureNightCottageEmoji,
  getPrivateConversationCreatorChannelLookupNames,
  getPrivateConversationThemeIndexFromName,
  getPrivateConversationThemes,
  getPublicDaySideRoomNames,
  getTownsquareVoiceChannelLookupNames,
  pickUnusedPrivateConversationThemeIndex
}
