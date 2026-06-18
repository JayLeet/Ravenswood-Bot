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
    const moveAction = getMoveButtonAction(interaction)
    if (!moveAction) return null

    if (context.view.phase !== 'night') {
      return editDashboardFailure(interaction, {
        title: 'Night only',
        message: 'Storyteller movement controls are only available during night.',
        suggestion: 'Use normal day voice channels during day discussion and nominations.'
      })
    }

    if (moveAction === 'open') {
      const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateMovePayload(interaction, createMoveTargetsPayload(context.view, labels))
    }

    if (moveAction === 'back') {
      const selectedPlayerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
      const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateMovePayload(interaction, createStorytellerDashboardPayload(context.view, {
        selectedPlayerId,
        playerLabels: labels
      }))
    }

    if (moveAction === 'den') {
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
  return Boolean(getMoveButtonAction(customId))
}

function getMoveButtonAction(input) {
  const customId = getMoveCustomId(input)
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.move ||
    customId === `${STORYTELLER_DASHBOARD_ACTIONS.action}:move`) return 'open'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.moveBack) return 'back'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.moveDen ||
    customId === STORYTELLER_DASHBOARD_ACTIONS.goToDen) return 'den'
  if (parseMovePlayerCustomId(customId)) return 'player'
  if (getMoveComponentLabel(input) === 'Move') return 'open'
  return null
}

function getMoveCustomId(input) {
  if (typeof input === 'string') return input
  return String(input?.customId || '')
}

function getMoveComponentLabel(input) {
  if (!input || typeof input === 'string') return ''
  return getComponentLabel(input.component) ||
    findClickedComponentLabel(input.message?.components, input.customId)
}

function getComponentLabel(component) {
  if (!component) return ''
  const data = component.toJSON?.() || component.data || component
  return String(data.label || component.label || '')
}

function findClickedComponentLabel(rows, customId) {
  for (const row of rows || []) {
    for (const component of row.components || []) {
      const data = component.toJSON?.() || component.data || component
      if (data?.custom_id === customId || data?.customId === customId) return String(data.label || '')
    }
  }
  return ''
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
  getMoveButtonAction,
  isMoveButton,
  moveStoryteller
}
