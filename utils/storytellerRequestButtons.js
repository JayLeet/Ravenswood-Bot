const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  applyButtonEmoji
} = require('./buttonEmoji')

const STORYTELLER_REQUEST_PREFIX = 'botc:storyteller-request:'

function createRequestStorytellerRow(guildId, playerId) {
  return new ActionRowBuilder().addComponents(
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createStorytellerRequestCustomId('ask', guildId, playerId))
        .setLabel('Request Storyteller')
        .setStyle(ButtonStyle.Primary),
      'Request Storyteller'
    )
  )
}

function createStorytellerMoveRequestPayload({
  pingPlayer = true,
  playerId,
  playerLabel = null,
  storytellerId = null
}) {
  const label = playerLabel || `<@${playerId}>`
  return {
    content: [storytellerId ? `<@${storytellerId}>` : null, pingPlayer ? `<@${playerId}>` : null].filter(Boolean).join(' '),
    embeds: [
      new EmbedBuilder()
        .setTitle('Storyteller Requested')
        .setDescription(`${label} asked the Storyteller to visit their night channel.`)
        .setColor(0x9b59b6)
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        applyButtonEmoji(
          new ButtonBuilder()
            .setCustomId(createStorytellerRequestCustomId('move', 'current', playerId))
            .setLabel('Move')
            .setStyle(ButtonStyle.Primary),
          'Move'
        )
      )
    ]
  }
}

function createStorytellerRequestCustomId(action, guildId, playerId) {
  return `${STORYTELLER_REQUEST_PREFIX}${action}:${guildId}:${playerId}`
}

function parseStorytellerRequestCustomId(customId) {
  if (!String(customId || '').startsWith(STORYTELLER_REQUEST_PREFIX)) return null
  const [action, guildId, ...playerParts] = String(customId).slice(STORYTELLER_REQUEST_PREFIX.length).split(':')
  return {
    action,
    guildId: guildId === 'current' ? null : guildId,
    playerId: playerParts.join(':') || null
  }
}

function isStorytellerRequestInteraction(customId) {
  return Boolean(parseStorytellerRequestCustomId(customId))
}

module.exports = {
  createRequestStorytellerRow,
  createStorytellerRequestCustomId,
  createStorytellerMoveRequestPayload,
  isStorytellerRequestInteraction,
  parseStorytellerRequestCustomId
}
