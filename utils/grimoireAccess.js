const {
  EmbedBuilder
} = require('discord.js')
const {
  createGrimoireFields,
  formatGrimoireLine
} = require('./storytellerDashboard/grimoire')

function createGrimoireAccessGrantedMessage(userId) {
  return [
    `<@${userId}> you now have grimoire access.`,
    'Use `/grimoire` in this spectator channel to receive a private copy of the current grimoire.'
  ].join('\n')
}

function createGrimoireRequestNotice(userId, requestId) {
  return [
    `<@${userId}> requested grimoire access.`,
    `Storyteller: approve request ID \`${requestId}\` to grant access.`
  ].join('\n')
}

function createGrimoireRequestSubmittedMessage() {
  return [
    'Grimoire access request sent to the Storyteller.',
    'The Storyteller will review your request. If it is rejected, you will be notified.'
  ].join('\n')
}

function createCurrentGrimoirePayload(view, playerLabels = {}) {
  const embed = new EmbedBuilder()
    .setTitle('Current Grimoire')
    .setDescription(createGrimoireDescription(view))
    .setColor(0x9b59b6)
    .setTimestamp()

  const fields = createGrimoireFields(view, playerLabels)
  if (fields.length) embed.addFields(fields)
  else embed.addFields({ name: 'Grimoire', value: 'No players are in the grimoire yet.' })

  return { embeds: [embed] }
}

function createGrimoireDescription(view) {
  return [
    `Script: ${view.script || 'Unknown'}`,
    `State: ${view.state || 'Unknown'}`,
    `Phase: ${view.phaseLabel || view.phase || 'Unknown'}`,
    `Day: ${view.day || 0}`
  ].join('\n')
}

function createGrimoirePlayerLabels(view) {
  const labels = {}

  for (const userId of view?.users?.players || []) {
    labels[userId] = view.users.displayNames?.[userId] || `<@${userId}>`
  }

  return labels
}

function createPlainGrimoireLines(view, playerLabels = {}) {
  return (view?.users?.players || []).map(userId =>
    formatGrimoireLine(view, userId, playerLabels)
  )
}

module.exports = {
  createCurrentGrimoirePayload,
  createGrimoireAccessGrantedMessage,
  createGrimoirePlayerLabels,
  createGrimoireRequestNotice,
  createGrimoireRequestSubmittedMessage,
  createPlainGrimoireLines
}
