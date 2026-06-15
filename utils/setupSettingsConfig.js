const SETUP_SETTINGS_PREFIX = 'botc:setup-settings:'
const SETUP_SETTINGS_HOME_ID = `${SETUP_SETTINGS_PREFIX}home`
const SETUP_SETTINGS_APPLY_PREFIX = `${SETUP_SETTINGS_PREFIX}apply:`
const SETUP_SETTINGS_CHANNEL_SELECT_ID = `${SETUP_SETTINGS_PREFIX}channel`
const SETUP_SETTINGS_PROFILE_SELECT_ID = `${SETUP_SETTINGS_PREFIX}profile`
const SETUP_SETTINGS_ROLE_SELECT_ID = `${SETUP_SETTINGS_PREFIX}role`
const SETUP_SETTINGS_ROLE_PREFIX = `${SETUP_SETTINGS_PREFIX}role:`
const SETUP_SETTINGS_CHANNEL_PREFIX = `${SETUP_SETTINGS_PREFIX}channel:`
const SETUP_SETTINGS_TOGGLE_PREFIX = `${SETUP_SETTINGS_PREFIX}toggle:`
const SETUP_SETTINGS_BACK_PREFIX = `${SETUP_SETTINGS_PREFIX}back:`
const SETUP_SETTING_ROLE_KEYS = Object.freeze(['player', 'spectator', 'grimoireSpectator', 'storyteller'])
const SETUP_SETTING_CHANNEL_KEYS = Object.freeze(['gameChannel', 'playerGrimoireChannel', 'liveChannel', 'spectatorChannel', 'storytellerChannel', 'postGameChannel', 'gameLogChannel', 'waitingRoomVoiceChannel'])
const SETUP_SETTINGS_DEFAULTS = Object.freeze({ channelKey: 'liveChannel', profileKey: 'textReadOnly', roleKey: 'spectator', view: 'roles' })
const SETUP_SETTINGS_ROLE_EMOJI = Object.freeze({ player: '🎭', spectator: '👁️', grimoireSpectator: '🔎', storyteller: '📖' })
const SETUP_PERMISSION_PROFILES = Object.freeze({
  hidden: { label: 'Hidden', description: 'Cannot view the channel.', permissions: { ViewChannel: false } },
  textReadOnly: { label: 'Text: view only', description: 'Can view/read text but cannot chat.', permissions: { ViewChannel: true, ReadMessageHistory: true, SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false } },
  textChat: { label: 'Text: chat', description: 'Can view/read/chat in text channels.', permissions: { ViewChannel: true, ReadMessageHistory: true, UseApplicationCommands: true, SendMessages: true, SendMessagesInThreads: true } },
  voiceViewOnly: { label: 'Voice: view only', description: 'Can see the voice channel but cannot connect.', permissions: { ViewChannel: true, Connect: false, Speak: false, Stream: false, SendMessages: false } },
  voiceListen: { label: 'Voice: listen only', description: 'Can connect but cannot speak or stream.', permissions: { ViewChannel: true, Connect: true, Speak: false, Stream: false, SendMessages: false } },
  voiceSpeak: { label: 'Voice: speak', description: 'Can connect, speak, stream, and use voice chat.', permissions: { ViewChannel: true, Connect: true, Speak: true, Stream: true, ReadMessageHistory: true, SendMessages: true } }
})
const SETUP_SETTINGS_PERMISSION_ROWS = Object.freeze({
  text: [['ViewChannel', 'View'], ['ReadMessageHistory', 'Read History'], ['SendMessages', 'Send'], ['SendMessagesInThreads', 'Thread Chat'], ['CreatePublicThreads', 'Public Threads'], ['CreatePrivateThreads', 'Private Threads'], ['UseApplicationCommands', 'Commands'], ['AddReactions', 'Reactions'], ['AttachFiles', 'Files']],
  voice: [['ViewChannel', 'View'], ['Connect', 'Connect'], ['Speak', 'Speak'], ['Stream', 'Stream'], ['ReadMessageHistory', 'Read Chat'], ['SendMessages', 'Voice Chat'], ['UseApplicationCommands', 'Commands'], ['MoveMembers', 'Move Members'], ['MuteMembers', 'Mute Members']]
})
const CHANNEL_LABELS = Object.freeze({
  gameChannel: 'Game lobby/help', gameLogChannel: 'Game log', liveChannel: 'Live game chat',
  playerGrimoireChannel: 'Player grimoire',
  postGameChannel: 'Post-game chat', spectatorChannel: 'Spectator gallery',
  storytellerChannel: 'Storyteller dashboard', waitingRoomVoiceChannel: 'Waiting Room voice'
})
const ROLE_LABELS = Object.freeze({ grimoireSpectator: 'Grimoire Spectator', player: 'Player', spectator: 'Spectator', storyteller: 'Storyteller' })

module.exports = {
  CHANNEL_LABELS,
  ROLE_LABELS,
  SETUP_PERMISSION_PROFILES,
  SETUP_SETTINGS_APPLY_PREFIX,
  SETUP_SETTINGS_BACK_PREFIX,
  SETUP_SETTINGS_CHANNEL_PREFIX,
  SETUP_SETTINGS_CHANNEL_SELECT_ID,
  SETUP_SETTINGS_DEFAULTS,
  SETUP_SETTINGS_HOME_ID,
  SETUP_SETTINGS_PERMISSION_ROWS,
  SETUP_SETTINGS_PROFILE_SELECT_ID,
  SETUP_SETTINGS_ROLE_EMOJI,
  SETUP_SETTINGS_ROLE_PREFIX,
  SETUP_SETTINGS_ROLE_SELECT_ID,
  SETUP_SETTINGS_TOGGLE_PREFIX,
  SETUP_SETTING_CHANNEL_KEYS,
  SETUP_SETTING_ROLE_KEYS,
  SETUP_SETTINGS_PREFIX
}
