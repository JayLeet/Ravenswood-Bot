const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')

const GAME_LOG_PREFIX = 'botc:game-log'
const GAME_LOG_ACTIONS = Object.freeze({
  save: 'save',
  discard: 'discard'
})

function createGameLogDecisionRows(summaryId) {
  if (!summaryId) return []
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createGameLogCustomId(GAME_LOG_ACTIONS.save, summaryId))
        .setEmoji('\u{1F4BE}')
        .setLabel('Save to Game Log')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(createGameLogCustomId(GAME_LOG_ACTIONS.discard, summaryId))
        .setEmoji('\u{1F5D1}\u{FE0F}')
        .setLabel('Discard Game History')
        .setStyle(ButtonStyle.Secondary)
    )
  ]
}

function createResolvedGameLogRows(action) {
  const saved = action === GAME_LOG_ACTIONS.save
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${GAME_LOG_PREFIX}:resolved:${action}`)
        .setEmoji(saved ? '\u{2705}' : '\u{1F5D1}\u{FE0F}')
        .setLabel(saved ? 'Game Log Saved' : 'Game History Discarded')
        .setStyle(saved ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true)
    )
  ]
}

function isGameLogDecisionInteraction(customId) {
  return parseGameLogCustomId(customId) !== null
}

function parseGameLogCustomId(customId) {
  const prefix = `${GAME_LOG_PREFIX}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [action, ...idParts] = String(customId).slice(prefix.length).split(':')
  if (!Object.values(GAME_LOG_ACTIONS).includes(action)) return null
  return { action, summaryId: idParts.join(':') || null }
}

function createGameLogCustomId(action, summaryId) {
  return `${GAME_LOG_PREFIX}:${action}:${summaryId}`
}

module.exports = {
  GAME_LOG_ACTIONS,
  createGameLogDecisionRows,
  createResolvedGameLogRows,
  isGameLogDecisionInteraction,
  parseGameLogCustomId
}
