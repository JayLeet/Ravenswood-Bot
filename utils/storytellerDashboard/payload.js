const {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  createMainButtonRow,
  createRoleButtons,
  shouldShowVotingHistoryButton
} = require('./dashboardControls')
const {
  createScriptOptions
} = require('./options')
const {
  formatState
} = require('./formatters')
const {
  createVotingPanelPayload
} = require('../voting')

function createStorytellerDashboardPayload(view, options = {}) {
  const players = view.users.players || []
  const hasPlayers = players.length > 0
  const controlsDisabled = !view.storytellerId
  const clocktowerLiveMode = isClocktowerLiveMode(view)
  const scriptLocked = controlsDisabled || view.state !== 'lobby'
  const randomRolesLocked = controlsDisabled || view.state !== 'lobby' || !hasPlayers

  const embed = new EmbedBuilder()
    .setTitle('Storyteller Dashboard')
    .setDescription(createDashboardDescription(view))
    .setColor(0x9b59b6)
    .addFields(createDashboardFields(view))
    .setTimestamp()

  const buttonRow = createMainButtonRow(view, controlsDisabled)
  const roleButtons = createRoleButtons(view, controlsDisabled, randomRolesLocked, hasPlayers)
  const roleButtonRow = roleButtons.length
    ? new ActionRowBuilder().addComponents(roleButtons)
    : null
  const scriptRow = !clocktowerLiveMode && view.state === 'lobby'
    ? createScriptRow(view, scriptLocked)
    : null
  const baseRows = [buttonRow, scriptRow, roleButtonRow]

  return {
    embeds: [embed, ...createCurrentNominationEmbeds(view, options.playerLabels || {})],
    components: baseRows.filter(Boolean).slice(0, 5)
  }
}

function createScriptRow(view, scriptLocked) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.script)
      .setPlaceholder(`Script: ${view.script}`)
      .setDisabled(scriptLocked)
      .addOptions(createScriptOptions(view))
  )
}

function createDashboardDescription(view) {
  const storyteller = view.storytellerId ? `<@${view.storytellerId}>` : 'Replacement needed'

  return [
    `Storyteller: ${storyteller}`,
    `Script: ${view.script}`,
    `State: ${formatState(view.state)}`,
    `Phase: ${view.phaseLabel}`
  ].join('\n')
}

function createDashboardFields(view) {
  return [{
    name: 'Table',
    value: [
      `Players: ${view.counts.players}`,
      `Alive: ${view.counts.alive}`,
      `Dead: ${view.counts.dead}`,
      `Spectators: ${view.counts.spectators}`
    ].join('\n'),
    inline: true
  }]
}

function createCurrentNominationEmbeds(view, playerLabels = {}) {
  if (isClocktowerLiveMode(view)) return []
  const nomination = getCurrentNomination(view)
  if (!isRenderableNomination(nomination)) return []

  const payload = createVotingPanelPayload({
    nomination,
    view,
    playerLabels,
    disableVoteButtons: true
  })
  return payload.embeds || []
}

function isRenderableNomination(nomination) {
  return Boolean(nomination?.id && nomination?.nomineeId)
}

function getCurrentNomination(view) {
  return view.engine?.activeNomination ||
    [...(view.engine?.nominations || [])]
      .reverse()
      .find(nomination => nomination.status !== 'resolved') ||
    null
}

module.exports = {
  createCurrentNominationEmbeds,
  createRoleButtons,
  createStorytellerDashboardPayload,
  getCurrentNomination,
  isRenderableNomination,
  shouldShowVotingHistoryButton
}
