const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  applyButtonEmoji
} = require('./buttonEmoji')

const NOMINATION_REQUEST_PREFIX = 'botc:nomination-request'

function createRescindNominationRequestCustomId(requestId) {
  return `${NOMINATION_REQUEST_PREFIX}:rescind:${requestId}`
}

function createRescindNominationRequestRow(requestId) {
  return new ActionRowBuilder().addComponents(
    applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createRescindNominationRequestCustomId(requestId))
      .setLabel('Rescind Nomination')
      .setStyle(ButtonStyle.Secondary), 'Cancel')
  )
}

function createNominationsOpenedMessage() {
  return [
    'Nominations are now open.',
    '',
    'To nominate, use `/nominate` and choose the player you want to nominate.',
    'Your nomination will be sent to the Storyteller for approval before it becomes live.',
    'After submitting, you can use the private **Rescind Nomination** button if you change your mind.'
  ].join('\n')
}

function isNominationRequestInteraction(customId) {
  return typeof customId === 'string' && customId.startsWith(`${NOMINATION_REQUEST_PREFIX}:`)
}

function parseNominationRequestInteraction(customId) {
  if (!isNominationRequestInteraction(customId)) return null

  const [action, ...requestParts] = String(customId)
    .slice(`${NOMINATION_REQUEST_PREFIX}:`.length)
    .split(':')

  return {
    action,
    requestId: requestParts.join(':') || null
  }
}

module.exports = {
  createNominationsOpenedMessage,
  createRescindNominationRequestCustomId,
  createRescindNominationRequestRow,
  isNominationRequestInteraction,
  parseNominationRequestInteraction
}
