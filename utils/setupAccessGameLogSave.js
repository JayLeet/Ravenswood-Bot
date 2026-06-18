const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  GAME_LOG_SAVE_MODES,
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')

const SETUP_ACCESS_LOG_MODE_ACTION = 'log-mode'
const SETUP_ACCESS_LOG_MODE_PREFIX = `botc:setup-access:${SETUP_ACCESS_LOG_MODE_ACTION}`

function createSetupGameLogSaveField(gameLogSaveMode) {
  return {
    name: '\u{1F4DA} Game-log saving',
    value: formatSetupGameLogSaveMode(gameLogSaveMode),
    inline: false
  }
}

function createSetupGameLogSaveRow(privateAccess, gameLogSaveMode) {
  const selected = normalizeGameLogSaveMode(gameLogSaveMode, null)
  return new ActionRowBuilder().addComponents(
    createSetupGameLogSaveButton(GAME_LOG_SAVE_MODES.auto, privateAccess, selected),
    createSetupGameLogSaveButton(GAME_LOG_SAVE_MODES.manual, privateAccess, selected)
  )
}

function createSetupGameLogSaveButton(mode, privateAccess, selected) {
  const active = selected === mode
  return new ButtonBuilder()
    .setCustomId(createSetupGameLogSaveActionId(mode, privateAccess))
    .setEmoji(mode === GAME_LOG_SAVE_MODES.auto ? '\u{1F4E5}' : '\u{1F4BE}')
    .setLabel(mode === GAME_LOG_SAVE_MODES.auto ? 'Auto-save game logs' : 'Ask before saving')
    .setStyle(active ? ButtonStyle.Primary : ButtonStyle.Secondary)
}

function createSetupGameLogSaveActionId(mode, privateAccess) {
  return `${SETUP_ACCESS_LOG_MODE_PREFIX}:${mode}:${privateAccess ? 'private' : 'public'}`
}

function formatSetupGameLogSaveMode(gameLogSaveMode) {
  const mode = normalizeGameLogSaveMode(gameLogSaveMode, null)
  if (mode === GAME_LOG_SAVE_MODES.auto) return 'Auto-save when the game ends.'
  if (mode === GAME_LOG_SAVE_MODES.manual) return 'Ask the Storyteller to Save or Discard after each game.'
  return 'Choose how game logs should be handled after each game.'
}

module.exports = {
  SETUP_ACCESS_LOG_MODE_ACTION,
  createSetupGameLogSaveField,
  createSetupGameLogSaveRow
}
