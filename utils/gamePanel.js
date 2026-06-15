const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js')
const {
  GAME_MODE
} = require('./gameModes')

const GAME_PANEL_PREFIX = 'botc:game-panel:'

/** @type {import('../types').GamePanelActions} */
const GAME_PANEL_ACTIONS = {
  createClocktowerOnlineGame: `${GAME_PANEL_PREFIX}create-game:clocktower-live`,
  createDiscordOnlyGame: `${GAME_PANEL_PREFIX}create-game:discord-only`,
  createGame: `${GAME_PANEL_PREFIX}create-game`,
  games: `${GAME_PANEL_PREFIX}games`,
  help: `${GAME_PANEL_PREFIX}help`,
  join: `${GAME_PANEL_PREFIX}join`,
  leave: `${GAME_PANEL_PREFIX}leave`,
  requestGrim: `${GAME_PANEL_PREFIX}request-grim`,
  settings: `${GAME_PANEL_PREFIX}settings`,
  spectate: `${GAME_PANEL_PREFIX}spectate`,
  start: `${GAME_PANEL_PREFIX}start`
}

/** @returns {import('../types').DiscordMessagePayload} */
function createGamePanelPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('BOTC Game Lobby & Help')
        .setDescription(
          [
            'Create: choose a game mode, then open a new lobby and become Storyteller.',
            'Games: view currently open games in this server.',
            'Join: enter as a player or request to join a live game.',
            'Spectate: instantly watch the active game as a spectator.',
            'Request Grim: spectators can ask the Storyteller for grimoire access.',
            'Leave: step out of your current role.',
            'Help: view the bot command list.',
            'Settings: admin-only setup permission tools.',
            '',
            'The Storyteller starts and advances the game from their dashboard.'
          ].join('\n')
        )
        .setColor(0x3498db)
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.createGame)
          .setEmoji('📖')
          .setLabel('Create')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.games)
          .setEmoji('📜')
          .setLabel('Games')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.join)
          .setEmoji('👤')
          .setLabel('Join')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.spectate)
          .setEmoji('👁️')
          .setLabel('Spectate')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.requestGrim)
          .setEmoji('🔎')
          .setLabel('Request Grim')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.leave)
          .setEmoji('🚪')
          .setLabel('Leave')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.help)
          .setEmoji('❓')
          .setLabel('Help')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(GAME_PANEL_ACTIONS.settings)
          .setEmoji('⚙️')
          .setLabel('Settings')
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  }
}

function createGameModeChoicePayload({ includeTestGame = false } = {}) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(GAME_PANEL_ACTIONS.createDiscordOnlyGame)
      .setEmoji('💬')
      .setLabel('Discord-only')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(GAME_PANEL_ACTIONS.createClocktowerOnlineGame)
      .setEmoji('🕰️')
      .setLabel('Clocktower.live')
      .setStyle(ButtonStyle.Success)
  ]


  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('Choose Game Mode')
        .setDescription([
          'How will this game be run?',
          '',
          '**Discord-only** keeps BOTC Bot nominations, voting, and win checks enabled.',
          '**Clocktower.live** limits BOTC Bot to phase movement, player controls, voice movement, and ending the game.',
        ].filter(Boolean).join('\n'))
        .setColor(0x3498db)
        .setTimestamp()
    ],
    components: [new ActionRowBuilder().addComponents(...buttons)]
  }
}


/**
 * @param {string} customId
 * @returns {boolean}
 */
function isGamePanelAction(customId) {
  return Object.values(GAME_PANEL_ACTIONS).includes(customId)
}

function isGamePanelInteraction(interaction) {
  return isGamePanelAction(interaction?.customId)
}


function getGameModeFromCreateAction(customId) {
  if (customId === GAME_PANEL_ACTIONS.createClocktowerOnlineGame) {
    return GAME_MODE.clocktowerLive
  }
  if (customId === GAME_PANEL_ACTIONS.createDiscordOnlyGame) return GAME_MODE.discordOnly
  return null
}

module.exports = {
  GAME_MODE,
  GAME_PANEL_ACTIONS,
  createGameModeChoicePayload,
  createGamePanelPayload,
  getGameModeFromCreateAction,
  isGamePanelAction,
  isGamePanelInteraction,
}
