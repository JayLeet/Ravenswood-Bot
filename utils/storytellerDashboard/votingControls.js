const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')

function createVotingControlRows(view, disabled) {
  if (view.phase !== 'nominations') return []

  const activeNomination = view.engine.activeNomination
  const hasOpenVote = activeNomination?.status === 'voting'
  const hasActiveNomination = !!activeNomination
  const hasPausedVote = activeNomination?.status === 'seconded' && !!activeNomination.voteCancelledAt
  const canRunVote = activeNomination?.status === 'seconded' && !hasPausedVote
  const canRestartVote = hasOpenVote
  const canToggleVote = hasOpenVote || hasPausedVote
  const hasExecutionCandidate = !!view.engine.executionCandidate
  const speedLabel = formatSpeedLabel(activeNomination?.voteClockhandSpeedMs || view.engine.voteClockhandSpeedMs)

  const firstRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.openVote)
      .setLabel('Run Vote')
      .setDisabled(disabled || !canRunVote)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.resetVoteCursor)
      .setLabel('Restart Vote')
      .setDisabled(disabled || !canRestartVote)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.cancelVote)
      .setLabel(hasPausedVote ? 'Resume Vote' : 'Pause Vote')
      .setDisabled(disabled || !canToggleVote)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.setVoteThreshold)
      .setLabel('Set Threshold')
      .setDisabled(disabled || !hasActiveNomination)
      .setStyle(ButtonStyle.Secondary)
  )

  const secondRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.setVoteClockhandSpeed)
      .setLabel(`Set Speed${speedLabel ? ` (${speedLabel})` : ''}`)
      .setDisabled(disabled)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.cancelNomination)
      .setLabel('Cancel Nomination')
      .setDisabled(disabled || !hasActiveNomination)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.clearExecutionCandidate)
      .setLabel('Clear Block')
      .setDisabled(disabled || !hasExecutionCandidate)
      .setStyle(ButtonStyle.Secondary)
  )

  for (const row of [firstRow, secondRow]) {
    for (const button of row.components) applyButtonEmoji(button, button.data?.label)
  }

  return [firstRow, secondRow]
}

function formatSpeedLabel(speedMs) {
  const value = Number(speedMs)
  if (!Number.isFinite(value)) return '1s'
  return `${Number((value / 1000).toFixed(1))}s`
}

module.exports = {
  createVotingControlRows,
  formatSpeedLabel
}
