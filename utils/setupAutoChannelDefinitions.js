const {
  AUTO_SETUP_CATEGORY_NAME,
  BOT_UPDATE_CHANNEL_NAME
} = require('./botcChannelNames')

const SETUP_TEXT_CHANNEL_ORDER = Object.freeze(
  ['gameChannel', 'playerGrimoireChannel', 'storytellerChannel', 'liveChannel', 'postGameChannel', 'spectatorChannel']
)
const AUTO_SETUP_CHANNELS = Object.freeze({
  game: {
    key: 'gameChannel',
    name: '\u{1F3AD}-game-lobby-help',
    reason: 'BOTC game panel channel',
    lockedPanel: true
  },
  storyteller: {
    key: 'storytellerChannel',
    name: '\u{1F4D6}-storyteller-dashboard',
    reason: 'BOTC Storyteller command channel',
    allowedRoleKeys: ['storyteller']
  },
  playerGrimoire: {
    key: 'playerGrimoireChannel',
    name: '\u{1F4D6}-your-grimoire',
    reason: 'BOTC player grimoire channel',
    readOnlyRoleKeys: ['player', 'storyteller']
  },
  live: {
    key: 'liveChannel',
    name: '\u{1F4E3}-live-game-chat',
    reason: 'BOTC live game announcements channel',
    allowedRoleKeys: ['player', 'storyteller'],
    readOnlyRoleKeys: ['spectator', 'grimoireSpectator']
  },
  postGame: {
    key: 'postGameChannel',
    name: '\u{1F50E}-post-game-chat',
    reason: 'BOTC post-game reveal chat channel',
    hiddenFromRoleKeys: ['player', 'spectator', 'storyteller']
  },
  spectator: {
    key: 'spectatorChannel',
    name: '\u{1F441}\u{FE0F}-spectator-gallery',
    reason: 'BOTC spectator info channel',
    allowedRoleKeys: ['grimoireSpectator', 'storyteller']
  }
})
const AUTO_SETUP_GAME_LOG_CHANNEL = Object.freeze({
  key: 'gameLogChannel',
  name: '\u{1F5C2}\u{FE0F}-game-log',
  reason: 'BOTC optional game log archive channel',
  lockedPanel: true
})

module.exports = {
  AUTO_SETUP_CATEGORY_NAME,
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  BOT_UPDATE_CHANNEL_NAME,
  SETUP_TEXT_CHANNEL_ORDER
}
