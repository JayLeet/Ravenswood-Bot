const {
  STORYTELLER_DASHBOARD_ACTIONS,
  createPlayerButtonPanelPayload,
  createPlayerControlPanelPayload,
  parsePlayerControlPlayerCustomId
} = require('../../embeds')
const {
  editDashboardFailure,
  editDashboardSuccess
} = require('../feedback')
const {
  queuedVoiceMove
} = require('../../../../utils/discord/voiceActions')
const {
  updateControlPayload
} = require('./randomRoleButton')
const {
  createFakeDiscordOnlyDashboardFailure,
  formatDashboardPlayer,
  isFakeDashboardPlayer
} = require('./fakePlayers')
const {
  fetchDashboardMember
} = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'PlayerControlButtons' })

function createPlayerControlButtonHandler({
  dashboardState,
  gameLifecycle,
  getDashboardPlayerLabels,
  handleDashboardLifecycleResult,
  postOrUpdateStorytellerDashboard
}) {
  return async function handlePlayerControlButton(interaction, context) {
    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlPanel) {
      return showPlayerControlPanel(interaction, context, { dashboardState, getDashboardPlayerLabels })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayers) {
      return showPlayerButtonPanel(interaction, context, { dashboardState, getDashboardPlayerLabels })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlBack) {
      return editDashboardSuccess(interaction, 'Back to the Storyteller dashboard.')
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlDisconnect) {
      return disconnectSelectedPlayer(interaction, context, { dashboardState })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlKick) {
      return kickSelectedPlayer(interaction, context, {
        dashboardState,
        gameLifecycle,
        handleDashboardLifecycleResult
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlKill) {
      return setSelectedPlayerLife(interaction, context, {
        dashboardState,
        gameLifecycle,
        handleDashboardLifecycleResult,
        lifeAction: 'kill'
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.playerControlRevive) {
      return setSelectedPlayerLife(interaction, context, {
        dashboardState,
        gameLifecycle,
        handleDashboardLifecycleResult,
        lifeAction: 'revive'
      })
    }

    const parsed = parsePlayerControlPlayerCustomId(interaction.customId)
    if (!parsed) return null
    return choosePlayer(interaction, context, {
      dashboardState,
      getDashboardPlayerLabels,
      playerId: parsed.playerId,
      postOrUpdateStorytellerDashboard
    })
  }
}

async function showPlayerControlPanel(interaction, context, deps) {
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  const selectedPlayerId = deps.dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  return updateControlPayload(interaction, createPlayerControlPanelPayload(context.view, selectedPlayerId, labels))
}

async function showPlayerButtonPanel(interaction, context, deps) {
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  const selectedPlayerId = deps.dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  return updateControlPayload(interaction, createPlayerButtonPanelPayload(context.view, selectedPlayerId, labels))
}

async function choosePlayer(interaction, context, deps) {
  if (!(context.view.users.players || []).includes(deps.playerId)) {
    return editDashboardFailure(interaction, {
      title: 'Player not found',
      message: 'That player is not in the current game anymore.',
      suggestion: 'Open Player Controls and choose another player.'
    })
  }

  deps.dashboardState.setSelectedPlayer(interaction.guild.id, interaction.member.id, deps.playerId)
  await deps.postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id, deps.playerId)
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  return updateControlPayload(interaction, createPlayerControlPanelPayload(context.view, deps.playerId, labels))
}

async function disconnectSelectedPlayer(interaction, context, deps) {
  const rawPlayerId = getRawSelectedPlayerId(interaction, deps.dashboardState)
  if (rawPlayerId && isFakeDashboardPlayer(context, rawPlayerId)) {
    return editDashboardFailure(interaction, createFakeDiscordOnlyDashboardFailure(context, rawPlayerId, 'voice disconnect'))
  }

  const playerId = getSelectedPlayerId(context, rawPlayerId)
  if (!playerId) return selectPlayerFirst(interaction)

  const member = await fetchDashboardMember(interaction, playerId, 'fetch-disconnect-player-member')
  if (!member) return playerNotFound(interaction)
  if (!member.voice?.channelId) {
    return editDashboardSuccess(interaction, `${formatDashboardPlayer(context, playerId)} is not connected to voice.`)
  }

  const disconnected = await queuedVoiceMove(member, null)
    .then(() => true)
    .catch(err => { log.recoverable('disconnect-player-from-dashboard', err, { guildId: interaction.guild.id, playerId }); return false })
  return disconnected
    ? editDashboardSuccess(interaction, `Disconnected ${formatDashboardPlayer(context, playerId)} from voice.`)
    : editDashboardFailure(interaction, {
      title: 'Disconnect failed',
      message: `I found ${formatDashboardPlayer(context, playerId)}, but could not disconnect them from voice.`,
      suggestion: 'Check bot Move Members permission and role hierarchy, then try again.'
    })
}

async function kickSelectedPlayer(interaction, context, deps) {
  const rawPlayerId = getRawSelectedPlayerId(interaction, deps.dashboardState)
  if (rawPlayerId && isFakeDashboardPlayer(context, rawPlayerId)) {
    return editDashboardFailure(interaction, createFakeDiscordOnlyDashboardFailure(context, rawPlayerId, 'kick/replacement'))
  }

  const playerId = getSelectedPlayerId(context, rawPlayerId)
  if (!playerId) return selectPlayerFirst(interaction)

  const member = await fetchDashboardMember(interaction, playerId, 'fetch-kick-player-member')
  if (!member) return playerNotFound(interaction)

  const result = await deps.gameLifecycle.kickPlayer(interaction.guild.id, interaction.member, member)
  return deps.handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? 'Player kicked. The game is paused until a replacement join request is approved.' : null,
    result.ok ? result.publicMessage : null
  )
}

async function setSelectedPlayerLife(interaction, context, deps) {
  const playerId = getSelectedPlayerId(context, getRawSelectedPlayerId(interaction, deps.dashboardState))
  if (!playerId) return selectPlayerFirst(interaction)

  const result = deps.lifeAction === 'revive'
    ? await deps.gameLifecycle.revivePlayer(interaction.guild.id, interaction.member, playerId)
    : await deps.gameLifecycle.killPlayer(interaction.guild.id, interaction.member, playerId)
  const verb = deps.lifeAction === 'revive' ? 'revived' : 'killed'

  return deps.handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `${formatDashboardPlayer(context, playerId)} was ${verb}.` : null,
    result.ok ? result.publicMessage : null
  )
}

function getRawSelectedPlayerId(interaction, dashboardState) {
  return dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
}

function getSelectedPlayerId(context, playerId) {
  return (context.view.users.players || []).includes(playerId) ? playerId : null
}

function selectPlayerFirst(interaction) {
  return editDashboardFailure(interaction, {
    title: 'Select a player',
    message: 'Choose a player from Player Controls first.',
    suggestion: 'Press Player, choose someone, then use Kick or Disconnect.'
  })
}

function playerNotFound(interaction) {
  return editDashboardFailure(interaction, {
    title: 'Player not found',
    message: 'I could not find that player in this server.',
    suggestion: 'Refresh the dashboard and choose another player.'
  })
}

module.exports = {
  choosePlayer,
  createPlayerControlButtonHandler,
  disconnectSelectedPlayer,
  kickSelectedPlayer,
  setSelectedPlayerLife,
  showPlayerButtonPanel,
  showPlayerControlPanel
}
