const {
  createVoteClockhandSpeedModal,
  createVoteThresholdModal,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  showInteractionModal
} = require('../feedback')

function createVotingControlButtonHandler({
  gameLifecycle,
  handleDashboardLifecycleResult
}) {
  return async function handleVotingControlButton(interaction, context) {
    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.setVoteThreshold) {
      return showInteractionModal(interaction, createVoteThresholdModal(getCurrentThreshold(context)))
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.setVoteClockhandSpeed) {
      return showInteractionModal(interaction, createVoteClockhandSpeedModal(getCurrentSpeed(context)))
    }

    const action = getVotingControlAction(interaction.customId, context)
    if (!action) return null

    const result = await runVotingControlAction(action, interaction, context, gameLifecycle)
    const message = getVotingControlMessage(action)

    return handleDashboardLifecycleResult(
      interaction,
      context,
      result,
      result.ok ? message : null,
      result.ok ? result.publicMessage : null
    )
  }
}

function getCurrentThreshold(context) {
  const threshold = context.view.engine.activeNomination?.threshold
  return Number.isInteger(threshold) ? String(threshold) : ''
}

function getCurrentSpeed(context) {
  const speedMs = context.view.engine.activeNomination?.voteClockhandSpeedMs ||
    context.view.engine.voteClockhandSpeedMs
  const value = Number(speedMs)
  if (!Number.isFinite(value)) return '1'
  return String(Number((value / 1000).toFixed(1)))
}

function runVotingControlAction(action, interaction, context, gameLifecycle) {
  if (action === 'open_vote') {
    const nomineeId = context.view.engine.activeNomination?.nomineeId
    return gameLifecycle.openVote(interaction.guild.id, interaction.member, nomineeId)
  }

  if (action === 'resume_vote') {
    const nomineeId = context.view.engine.activeNomination?.nomineeId
    return gameLifecycle.openVote(interaction.guild.id, interaction.member, nomineeId)
  }

  if (action === 'restart_vote') {
    return gameLifecycle.resetVoteCount(interaction.guild.id, interaction.member)
  }

  if (action === 'cancel_nomination') {
    return gameLifecycle.cancelNomination(
      interaction.guild.id,
      interaction.member,
      context.view.engine.activeNomination?.id
    )
  }

  if (action === 'pause_vote') {
    return gameLifecycle.cancelCurrentVote(interaction.guild.id, interaction.member)
  }

  return gameLifecycle.clearExecutionCandidate(interaction.guild.id, interaction.member)
}

function getVotingControlMessage(action) {
  if (action === 'open_vote') return 'Started the vote count.'
  if (action === 'resume_vote') return 'Resumed the vote count.'
  if (action === 'restart_vote') return 'Restarted the vote count.'
  if (action === 'cancel_nomination') return 'Cancelled the current nomination.'
  if (action === 'pause_vote') return 'Paused the current vote.'
  return 'Cleared the execution candidate.'
}

function getVotingControlAction(customId, context = null) {
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.openVote) return 'open_vote'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.resetVoteCursor) return 'restart_vote'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.cancelNomination) return 'cancel_nomination'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.cancelVote) {
    const nomination = context?.view?.engine?.activeNomination
    return nomination?.status === 'seconded' && nomination.voteCancelledAt
      ? 'resume_vote'
      : 'pause_vote'
  }
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.clearExecutionCandidate) return 'clear_execution_candidate'
  return null
}

module.exports = {
  createVotingControlButtonHandler,
  getCurrentSpeed,
  getCurrentThreshold,
  getVotingControlAction,
  getVotingControlMessage,
  runVotingControlAction
}
