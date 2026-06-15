const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  applyButtonEmoji
} = require('./buttonEmoji')

const REQUEST_DECISION_PREFIX = 'botc:request-decision:'

function createRequestDecisionRows(requests = []) {
  return requests.slice(0, 5).map(request =>
    new ActionRowBuilder().addComponents(
      applyButtonEmoji(
        new ButtonBuilder()
          .setCustomId(createRequestDecisionCustomId('approve', request.id))
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success),
        'Approve'
      ),
      applyButtonEmoji(
        new ButtonBuilder()
          .setCustomId(createRequestDecisionCustomId('reject', request.id))
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger),
        'Reject'
      )
    )
  )
}

function createRequestDecisionCustomId(action, requestId) {
  return `${REQUEST_DECISION_PREFIX}${action}:${encodeURIComponent(requestId)}`
}

function parseRequestDecisionCustomId(customId) {
  if (!String(customId || '').startsWith(REQUEST_DECISION_PREFIX)) return null
  const [action, ...idParts] = String(customId).slice(REQUEST_DECISION_PREFIX.length).split(':')
  return {
    action,
    requestId: decodeURIComponent(idParts.join(':') || '')
  }
}

function isRequestDecisionInteraction(customId) {
  return Boolean(parseRequestDecisionCustomId(customId))
}

module.exports = {
  createRequestDecisionCustomId,
  createRequestDecisionRows,
  isRequestDecisionInteraction,
  parseRequestDecisionCustomId
}