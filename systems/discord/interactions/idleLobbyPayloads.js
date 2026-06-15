const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')

const IDLE_LOBBY_PREFIX = 'botc:idle-lobby:'
const IDLE_LOBBY_ACTIONS = Object.freeze({
  dismiss: `${IDLE_LOBBY_PREFIX}dismiss`,
  here: `${IDLE_LOBBY_PREFIX}here`
})
const FIRST_WARNING_MS = 5 * 60 * 1000
const RESPONSE_WINDOW_MS = 5 * 60 * 1000
const FINAL_WARNING_MS = 60 * 1000
const CREATE_GAME_COOLDOWN_MS = 15 * 60 * 1000
const IDLE_WARNING_MEMORY_MS = 60 * 60 * 1000
const MAX_WARNINGS = 3

function createIdleWarningPayload(storytellerId, warningNumber = 1) {
  const remaining = Math.max(0, MAX_WARNINGS - warningNumber)
  return {
    content: `<@${storytellerId}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`Are you still there? Warning ${warningNumber}/${MAX_WARNINGS}`)
      .setDescription(createIdleWarningDescription(remaining))
      .setColor(0xf1c40f)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(IDLE_LOBBY_ACTIONS.here)
        .setLabel("I'm here!")
        .setStyle(ButtonStyle.Success)
    )]
  }
}

function createIdleWarningDescription(remaining) {
  return [
    'Press I\'m here! to keep this lobby open and reset the idle warning count.',
    remaining > 1
      ? `${remaining} warnings remain before the final warning.`
      : 'One warning remains before the final warning.',
    'On the final warning, the button only dismisses the warning and the lobby is destroyed 1 minute later.',
    'If the lobby is destroyed by the final warning, you cannot create a new game for 15 minutes.',
    'If this lobby is closed without a response, this warning count carries to your next created lobby for 1 hour.'
  ].join('\n')
}

function createFinalWarningPayload(storytellerId) {
  return {
    content: `<@${storytellerId}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`Final idle warning ${MAX_WARNINGS}/${MAX_WARNINGS}`)
      .setDescription([
        'This lobby will be destroyed in 1 minute.',
        'Press Got it to dismiss this warning. The lobby will still be destroyed when the timer ends.',
        'You cannot create a new game for 15 minutes after it is destroyed.'
      ].join('\n'))
      .setColor(0xe74c3c)
      .setTimestamp()],
    components: [createDismissRow()]
  }
}

function createAcknowledgedEmbed() {
  return new EmbedBuilder()
    .setTitle('Idle check cleared')
    .setDescription('Thanks. The idle warning count has been reset and the lobby will stay open.')
    .setColor(0x2ecc71)
    .setTimestamp()
}

function createDismissRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDLE_LOBBY_ACTIONS.dismiss)
      .setLabel('Got it')
      .setStyle(ButtonStyle.Secondary)
  )
}

function isIdleLobbyInteraction(customId) {
  return Object.values(IDLE_LOBBY_ACTIONS).includes(customId)
}

module.exports = {
  CREATE_GAME_COOLDOWN_MS,
  FINAL_WARNING_MS,
  FIRST_WARNING_MS,
  IDLE_LOBBY_ACTIONS,
  IDLE_WARNING_MEMORY_MS,
  MAX_WARNINGS,
  RESPONSE_WINDOW_MS,
  createAcknowledgedEmbed,
  createDismissRow,
  createFinalWarningPayload,
  createIdleWarningDescription,
  createIdleWarningPayload,
  isIdleLobbyInteraction
}
