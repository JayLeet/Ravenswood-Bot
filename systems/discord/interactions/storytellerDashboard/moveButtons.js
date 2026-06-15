const {
  createMoveTargetsPayload,
  createStorytellerDashboardPayload,
  parseMovePlayerCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  acknowledgeInteraction,
  editDashboardFailure,
  editDashboardSuccess,
  editInteractionReply
} = require('../feedback')
const {
  queuedVoiceMove
} = require('../../../../utils/discord/voiceActions')
const {
  fetchDashboardMember
} = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'MoveButtons' })

function createMoveButtonHandler({
  dashboardState,
  getDashboardPlayerLabels,
  services
}) {
  return async function handleMoveButton(interaction, context) {
    if (!isMoveButton(interaction.customId)) return null

    if (context.view.phase !== 'night') {
      return editDashboardFailure(interaction, {
        title: 'Night only',
        message: 'Storyteller movement controls are only available during night.',
        suggestion: 'Use normal day voice channels during day discussion and nominations.'
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.move) {
      const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateMovePayload(interaction, createMoveTargetsPayload(context.view, labels))
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.moveBack) {
      const selectedPlayerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
      const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateMovePayload(interaction, createStorytellerDashboardPayload(context.view, {
        selectedPlayerId,
        playerLabels: labels
      }))
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.moveDen) {
      const channel = await services.ensureStorytellerDenVoiceChannel?.(interaction, context)
      return moveStoryteller(interaction, channel, 'Moved you to the Storyteller Den.')
    }

    const parsed = parseMovePlayerCustomId(interaction.customId)
    if (!parsed) return null

    const targetMember = await fetchDashboardMember(interaction, parsed.playerId, 'fetch-move-target-member')
    if (!targetMember) {
      return editDashboardFailure(interaction, {
        title: 'Player missing',
        message: 'I could not find that player in this server.',
        suggestion: 'Refresh the dashboard and try again.'
      })
    }

    const channel = await services.ensurePlayerNightVoiceChannel?.(interaction, context, targetMember)
    return moveStoryteller(interaction, channel, `Moved you to ${targetMember.displayName || 'that player'}'s cottage.`)
  }
}

async function moveStoryteller(interaction, channel, successMessage) {
  if (!channel) {
    return editDashboardFailure(interaction, {
      title: 'Voice channel missing',
      message: 'I could not create or find that voice channel.',
      suggestion: 'Check the bot has Manage Channels and Move Members, then try again.'
    })
  }

  const storytellerMember = await fetchDashboardMember(
    interaction,
    interaction.member.id,
    'fetch-move-storyteller-member',
    interaction.member
  )

  if (!storytellerMember?.voice?.channelId) {
    return editDashboardFailure(interaction, {
      title: 'Join voice first',
      message: 'Join any voice channel first, then press the move button again.',
      suggestion: 'Discord only lets the bot move you while you are connected to voice.'
    })
  }

  const moved = await queuedVoiceMove(storytellerMember, channel)
    .then(() => true)
    .catch(err => { log.recoverable('move-storyteller-from-move-buttons', err, { channelId: channel.id, guildId: interaction.guild.id, storytellerId: interaction.member.id }); return false })

  if (!moved) {
    return editDashboardFailure(interaction, {
      title: 'Move failed',
      message: `I found ${channel.name || 'the voice channel'}, but could not move you there.`,
      suggestion: 'Check the bot has Move Members permission and its role is high enough.'
    })
  }

  return editDashboardSuccess(interaction, successMessage)
}

function isMoveButton(customId) {
  return customId === STORYTELLER_DASHBOARD_ACTIONS.move ||
    customId === STORYTELLER_DASHBOARD_ACTIONS.moveBack ||
    customId === STORYTELLER_DASHBOARD_ACTIONS.moveDen ||
    Boolean(parseMovePlayerCustomId(customId))
}

async function updateMovePayload(interaction, payload) {
  if (typeof interaction.botcUpdateDashboardPayload === 'function') {
    await interaction.botcUpdateDashboardPayload(payload)
    return acknowledgeInteraction(interaction)
  }

  return editInteractionReply(interaction, payload)
}

module.exports = {
  createMoveButtonHandler,
  isMoveButton,
  moveStoryteller
}
