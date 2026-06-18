const {
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  BOT_UPDATE_CHANNEL_NAME
} = require('./setupAutoChannelDefinitions')
const {
  SETUP_SHARED_VOICE_CHANNELS
} = require('./setupVoiceChannels')
const {
  RESERVED_NIGHT_VOICE_NAME
} = require('../systems/discord/interactions/nightArea/reservedChannelNames')
const {
  createGameManagerRoleDefaults
} = require('../systems/game/GameManagerDefaults')
const {
  BOTC_ACCESS_ROLE_NAME
} = require('./botcAccessRole')
const {
  GRIMOIRE_SPECTATOR_ROLE_NAME
} = require('./grimoireSpectatorRole')

function createSetupPreviewSummaryFields(options = {}) {
  const importantLines = isManualSetup(options.mode)
    ? [
        'Manual setup uses the category, Waiting Room, game-log archive, and save behavior you choose.',
        'I create or reuse the remaining BOTC setup channels inside the selected category.'
      ]
    : [
        'Automatic setup resets only bot-managed Ravenswood Bluff and Reserved Night Area categories.',
        'User-created channels outside those bot-managed areas are left alone.'
      ]

  return [
    {
      name: '\u{1F30D} Public setup',
      value: 'Everyone can see the game category, its channels, and the game panel used to create or join games.',
      inline: false
    },
    {
      name: '\u{1F512} Private setup',
      value: `Only players with the "${BOTC_ACCESS_ROLE_NAME}" role can see the game category, its channels, and the game panel. I hide those setup areas from @everyone.`,
      inline: false
    },
    {
      name: '\u{1F4CB} What I manage',
      value: [
        '\u{1F9E9} Roles: 5',
        '\u{1F3F0} Categories: 2',
        '\u{1F4AC} Text channels: 8',
        '\u{1F50A} Voice channel groups: 5'
      ].join('\n'),
      inline: false
    },
    {
      name: '\u{26A0}\u{FE0F} Important',
      value: importantLines.join('\n'),
      inline: false
    }
  ]
}

function createSetupPreviewFields(options = {}) {
  const roleNames = createSetupRoleNames()
  const importantLines = isManualSetup(options.mode)
    ? [
        'Manual setup uses the category, Waiting Room, game-log archive, and game-log save behavior you choose.',
        'I create or reuse the rest of the BOTC setup inside the selected category.'
      ]
    : [
        'Automatic setup resets existing bot-managed Ravenswood Bluff and Reserved Night Area categories before rebuilding them.',
        'User-created channels outside those bot-managed areas are left alone.'
      ]

  return [
    {
      name: '\u{1F9E9} Roles I manage',
      value: [
        `- ${roleNames.player}`,
        `- ${roleNames.spectator}`,
        `- ${roleNames.storyteller}`,
        `- ${roleNames.grimoireSpectator} (with Grimoire access)`,
        `- ${roleNames.botcAccess} (for private setup)`
      ].join('\n'),
      inline: false
    },
    {
      name: '\u{1F3F0} Categories I manage',
      value: [
        '- Ravenswood Bluff',
        '- Reserved Night Area / cottage channels'
      ].join('\n'),
      inline: false
    },
    {
      name: '\u{1F4AC} Text channels',
      value: [
        `- ${BOT_UPDATE_CHANNEL_NAME}`,
        `- ${AUTO_SETUP_CHANNELS.game.name}`,
        `- ${AUTO_SETUP_CHANNELS.storyteller.name}`,
        `- ${AUTO_SETUP_CHANNELS.playerGrimoire.name}`,
        `- ${AUTO_SETUP_CHANNELS.live.name}`,
        `- ${AUTO_SETUP_CHANNELS.postGame.name}`,
        `- ${AUTO_SETUP_CHANNELS.spectator.name}`,
        `- ${AUTO_SETUP_GAME_LOG_CHANNEL.name}`
      ].join('\n'),
      inline: false
    },
    {
      name: '\u{1F50A} Voice channels',
      value: createSetupVoicePreviewLines().join('\n'),
      inline: false
    },
    {
      name: '\u{26A0}\u{FE0F} Important',
      value: importantLines.join('\n'),
      inline: false
    }
  ]
}

function createSetupVoicePreviewLines() {
  return [
    ...SETUP_SHARED_VOICE_CHANNELS.map(channel => `- ${channel.name}`),
    `- ${RESERVED_NIGHT_VOICE_NAME} channels`
  ]
}

function isManualSetup(mode) {
  return mode === 'manual'
}

function createSetupRoleNames() {
  const roleNames = createGameManagerRoleDefaults().roleNames
  return {
    player: roleNames.player,
    spectator: roleNames.spectator,
    storyteller: roleNames.storyteller,
    grimoireSpectator: GRIMOIRE_SPECTATOR_ROLE_NAME,
    botcAccess: BOTC_ACCESS_ROLE_NAME
  }
}

module.exports = {
  createSetupPreviewFields,
  createSetupPreviewSummaryFields
}
