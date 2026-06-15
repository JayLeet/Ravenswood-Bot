const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  STORYTELLER_DASHBOARD_ACTIONS,
  createNominationRequestCustomId
} = require('./constants')
const {
  createVotingControlRows
} = require('./votingControls')
const {
  formatNominationSummary
} = require('./formatters')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  createVotingPanelPayload
} = require('../voting')

function createNominationDashboardPayload(view, disabled = !view.storytellerId, playerLabels = {}) {
  const embed = new EmbedBuilder()
    .setTitle('Nomination Dashboard')
    .setDescription(createNominationDashboardDescription(view))
    .setColor(0xe67e22)
    .addFields(createNominationDashboardFields(view))
    .setTimestamp()

  return {
    embeds: [embed, ...createCurrentNominationEmbeds(view, playerLabels)],
    components: createNominationDashboardRows(view, disabled).slice(0, 5)
  }
}

function createNominationDashboardRows(view, disabled) {
  const externalMode = isClocktowerLiveMode(view)
  return [
    createNominationMainRow(view, disabled, externalMode),
    ...createVotingControlRows(view, disabled || externalMode),
    ...createNominationRequestRows(view, disabled || externalMode)
  ].filter(Boolean)
}

function createNominationMainRow(view, disabled, externalMode = false) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.forcedNomination)
      .setLabel('Nominate')
      .setDisabled(disabled || externalMode || view.phase !== 'nominations')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.votingLogs)
      .setLabel('Voting History')
      .setDisabled(disabled || externalMode)
      .setStyle(ButtonStyle.Secondary)
  ]

  for (const button of buttons) applyButtonEmoji(button, button.data?.label)
  return new ActionRowBuilder().addComponents(buttons)
}

function createNominationRequestRows(view, disabled) {
  return (view.engine.nominationRequests || [])
    .slice(0, 1)
    .map(request => new ActionRowBuilder().addComponents(
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNominationRequestCustomId('approve', request.id))
        .setLabel('Approve Nomination')
        .setDisabled(disabled)
        .setStyle(ButtonStyle.Success), 'Approve Nomination'),
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNominationRequestCustomId('reject', request.id))
        .setLabel('Reject')
        .setDisabled(disabled)
        .setStyle(ButtonStyle.Danger), 'Reject'),
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNominationRequestCustomId('cancel', request.id))
        .setLabel('Cancel')
        .setDisabled(disabled)
        .setStyle(ButtonStyle.Secondary), 'Cancel')
    ))
}

function createNominationDashboardDescription(view) {
  return [
    `Phase: ${view.phaseLabel || 'Nominations'}`,
    isClocktowerLiveMode(view)
      ? 'Clocktower.live mode: nominations, vote controls, and voting history are disabled here.'
      : null,
    `Active vote: ${formatNominationSummary(getCurrentNomination(view))}`,
    `On the block: ${view.engine.executionCandidate ? `<@${view.engine.executionCandidate.nomineeId}>` : 'None'}`
  ].filter(Boolean).join('\n')
}

function createNominationDashboardFields(view) {
  const fields = [{
    name: 'Controls',
    value: isClocktowerLiveMode(view)
      ? 'Use the external app for nominations and voting. The bot will not resolve win conditions automatically.'
      : 'Use this panel for nominations, vote controls, thresholds, and nomination requests.',
    inline: false
  }]
  const requests = view.engine.nominationRequests || []
  if (requests.length) {
    fields.push({
      name: 'Nomination Queue',
      value: createNominationRequestSummary(requests),
      inline: false
    })
  }
  return fields
}

function createCurrentNominationEmbeds(view, playerLabels = {}) {
  const nomination = getCurrentNomination(view)
  if (!isRenderableNomination(nomination)) return []

  return createVotingPanelPayload({
    nomination,
    view,
    playerLabels,
    disableVoteButtons: true
  }).embeds || []
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

function createNominationRequestSummary(requests) {
  return requests
    .slice(0, 5)
    .map((request, index) => `${index + 1}. <@${request.nominatorId}> → <@${request.nomineeId}>`)
    .join('\n')
}

module.exports = {
  createCurrentNominationEmbeds,
  createNominationDashboardPayload,
  createNominationDashboardRows,
  createNominationRequestRows,
  getCurrentNomination,
  isClocktowerOnlineMode: isClocktowerLiveMode,
  isRenderableNomination
}
