const {
  DASHBOARD_TEXT_INPUT_ID,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  queuedChannelSend
} = require('../../../../utils/discord/messageActions')
const {
  createFakeMember
} = require('../fakeMembers')
const {
  createSystemEmbed,
  editDashboardFailure
} = require('../feedback')
const {
  startStorytellerTimer
} = require('../timerActions')
const {
  deferIfNoStatusUpdater
} = require('./buttonHandler')
const {
  formatDashboardPlayer,
  isFakeDashboardPlayer
} = require('./fakePlayers')
const {
  fetchDashboardMember
} = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'StorytellerDashboardModals' })

function createStorytellerDashboardModalHandler({
  dashboardState,
  ensureStorytellerDashboardReady,
  gameLifecycle,
  handleDashboardLifecycleResult,
  services
}) {
  return async function handleStorytellerDashboardModal(interaction) {
    const context = await ensureStorytellerDashboardReady(interaction)
    if (!context.ok) return editDashboardFailure(interaction, context)
    await deferIfNoStatusUpdater(interaction)

    const text = interaction.fields.getTextInputValue(DASHBOARD_TEXT_INPUT_ID)

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.timerModal) {
      return handleTimerModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text)
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.voteThresholdModal) {
      return handleVoteThresholdModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text)
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.voteClockhandSpeedModal) {
      return handleVoteClockhandSpeedModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text)
    }

    const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
    if (!playerId) {
      return editDashboardFailure(interaction, {
        title: 'Select a player',
        message: 'Choose a player from the dashboard first.',
        suggestion: 'Use the player dropdown, then try again.'
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.reminderModal) {
      const result = await gameLifecycle.addReminder(
        interaction.guild.id,
        interaction.member,
        playerId,
        text
      )

      return handleDashboardLifecycleResult(
        interaction,
        context,
        result,
        result.ok ? `Added a reminder for ${formatDashboardPlayer(context, playerId)}.` : null
      )
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.secretModal) {
      return handleSecretInfoModal(interaction, context, playerId, text, {
        gameLifecycle,
        handleDashboardLifecycleResult,
        services
      })
    }

    return editDashboardFailure(interaction, {
      title: 'Unknown form',
      message: 'That dashboard form is not recognized.',
      suggestion: 'Refresh the dashboard and try again.'
    })
  }
}

async function handleSecretInfoModal(interaction, context, playerId, text, deps) {
  const { gameLifecycle, handleDashboardLifecycleResult, services } = deps
  const targetMember = await getDashboardTargetMember(interaction, context, playerId)

  if (!targetMember) {
    return editDashboardFailure(interaction, {
      title: 'Player not found',
      message: 'I could not find that player in this server.',
      suggestion: 'Refresh the dashboard and select the player again.'
    })
  }

  const channel = await services.ensurePlayerNightChannel(interaction, context, targetMember)

  if (!channel) {
    return editDashboardFailure(interaction, {
      title: 'Channel needed',
      message: 'I could not create or find that player private night channel.',
      suggestion: 'Check that I have Manage Channels, then try again.'
    })
  }

  const sent = await queuedChannelSend(channel, {
    embeds: [createSystemEmbed('Secret Info', text, 0x9b59b6)]
  }).then(() => true).catch(err => { log.recoverable('send-dashboard-secret-info', err, { channelId: channel.id, guildId: interaction.guild.id, playerId }); return false })

  if (!sent) {
    return editDashboardFailure(interaction, {
      title: 'Message blocked',
      message: `I could not post in <#${channel.id}>.`,
      suggestion: 'Check my channel permissions, then try sending the secret info again.'
    })
  }

  const result = await gameLifecycle.recordSecretInfo(
    interaction.guild.id,
    interaction.member,
    playerId
  )

  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `Sent secret info to ${formatDashboardPlayer(context, playerId)} in <#${channel.id}>.` : null
  )
}

async function handleTimerModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text) {
  const result = await startStorytellerTimer({
    gameLifecycle,
    interaction,
    minutes: text,
    serverConfig: context.serverConfig
  })

  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? result.message : null,
    null
  )
}

async function getDashboardTargetMember(interaction, context, playerId) {
  if (isFakeDashboardPlayer(context, playerId)) return createFakeMember(playerId, context.view)
  return fetchDashboardMember(interaction, playerId, 'fetch-secret-info-member')
}

function handleVoteClockhandSpeedModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text) {
  const result = gameLifecycle.setVoteClockhandSpeed(interaction.guild.id, interaction.member, text)
  const seconds = result.ok ? Number((result.speedMs / 1000).toFixed(1)) : text

  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `Set the vote clockhand speed to ${seconds} seconds.` : null,
    null
  )
}

function handleVoteThresholdModal(interaction, context, gameLifecycle, handleDashboardLifecycleResult, text) {
  const result = gameLifecycle.setCurrentVoteThreshold(interaction.guild.id, interaction.member, text)

  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `Set the current vote threshold to ${text}.` : null,
    result.ok ? result.publicMessage : null
  )
}

module.exports = {
  createStorytellerDashboardModalHandler,
  getDashboardTargetMember,
  handleSecretInfoModal,
  handleTimerModal,
  handleVoteClockhandSpeedModal,
  handleVoteThresholdModal
}
