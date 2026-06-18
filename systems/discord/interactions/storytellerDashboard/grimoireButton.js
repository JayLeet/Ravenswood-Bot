const {
  createFullGrimoirePayload,
  createGrimoireMenuPayload,
  createMobileGrimoirePayload,
  createPlayerGrimoirePayload,
  createReminderTokenPayload,
  parseGrimoireCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  acknowledgeInteraction,
  editDashboardFailure,
  editDashboardLifecycleFailure,
  editDashboardSuccess
} = require('../feedback')
const { queuedVoiceMove } = require('../../../../utils/discord/voiceActions')
const { updateControlPayload } = require('./randomRoleButton')
const { isFakeDashboardPlayer } = require('./fakePlayers')
const {
  editRevealBoardFailure,
  postGrimRevealBoard,
  rollbackUnpostedReveal
} = require('./revealBoardPosting')
const {
  trackRevealBoardMessage
} = require('./endRevealOpen')
const { handleLunaticGrimoireButton, isLunaticGrimoireAction } = require('./lunaticGrimoireButtons')
const { createImpReplacementChoicePayload } = require('./impReplacementPayload')
const { fetchDashboardMember } = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'GrimoireButton' })

function createGrimoireButtonHandler({
  clearDashboardStatus,
  gameLifecycle,
  gameManager = null,
  getDashboardPlayerLabels,
  handleDashboardLifecycleResult = null,
  postOrUpdateStorytellerDashboard,
  services
}) {
  return async function handleGrimoireButton(interaction, context) {
    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.grimoire) {
      const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateControlPayload(interaction, createGrimoireMenuPayload(context.view, labels))
    }

    const parsed = parseGrimoireCustomId(interaction.customId)
    if (!parsed) return null

    const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)

    if (parsed.action === 'dashboard') {
      await postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id)
      await clearDashboardStatus?.(interaction, context.serverConfig)
      return acknowledgeInteraction(interaction)
    }

    if (parsed.action === 'back') {
      return updateControlPayload(interaction, createGrimoireMenuPayload(context.view, labels))
    }

    if (parsed.action === 'full') {
      return updateControlPayload(interaction, createFullGrimoirePayload(context.view, labels))
    }

    if (parsed.action === 'mobile') {
      return updateControlPayload(interaction, createMobileGrimoirePayload(context.view, labels))
    }

    if (parsed.action === 'player') {
      return updateControlPayload(interaction, createPlayerGrimoirePayload(context.view, parsed.playerId, labels))
    }

    if (parsed.action === 'tokens') {
      return updateControlPayload(interaction, createReminderTokenPayload(context.view, parsed.playerId, labels))
    }

    if (isLunaticGrimoireAction(parsed.action)) {
      return handleLunaticGrimoireButton(interaction, parsed, labels, gameLifecycle, context.view)
    }

    if (parsed.action === 'imp-replace') {
      const result = await gameLifecycle.assignManualImpReplacement(
        interaction.guild.id,
        interaction.member,
        parsed.playerId,
        parsed.value
      )
      return handleImpReplacementResult(interaction, context, result, parsed.playerId, labels)
    }

    if (parsed.action === 'token' || parsed.action === 'untoken') {
      const result = await gameLifecycle.setPlayerStatus(
        interaction.guild.id,
        interaction.member,
        parsed.playerId,
        parsed.value,
        parsed.action === 'token'
      )
      return handlePlayerGrimoireResult(interaction, context, result, parsed.playerId, labels, {
        gameLifecycle,
        gameManager,
        getDashboardPlayerLabels,
        handleDashboardLifecycleResult
      })
    }

    if (parsed.action === 'kill' || parsed.action === 'revive') {
      const result = parsed.action === 'kill'
        ? await gameLifecycle.killPlayer(interaction.guild.id, interaction.member, parsed.playerId)
        : await gameLifecycle.revivePlayer(interaction.guild.id, interaction.member, parsed.playerId)
      return handlePlayerGrimoireResult(interaction, context, result, parsed.playerId, labels, {
        gameLifecycle,
        gameManager,
        getDashboardPlayerLabels,
        handleDashboardLifecycleResult
      })
    }

    if (parsed.action === 'move') {
      return moveStorytellerToPlayer(interaction, context, parsed.playerId, services)
    }

    return editDashboardFailure(interaction, {
      title: 'Unknown grimoire control',
      message: 'That grimoire button is not recognized.',
      suggestion: 'Open View Grimoire again from the Storyteller dashboard.'
    })
  }
}

async function handlePlayerGrimoireResult(interaction, context, result, playerId, labels, deps = {}) {
  const normalizedDeps = normalizeGrimoireResultDeps(deps)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)

  if (result.replacement?.pendingChoice) {
    return updateControlPayload(interaction, createImpReplacementChoicePayload(result.view, result.replacement, labels))
  }

  if (result.manualKillReveal) {
    return postManualRevealBoard(interaction, context, result, normalizedDeps)
  }

  if (result.ended) {
    if (normalizedDeps.handleDashboardLifecycleResult) {
      return normalizedDeps.handleDashboardLifecycleResult(interaction, context, result)
    }

    return editDashboardSuccess(interaction, 'The game ended before the Grimoire could be refreshed.')
  }

  if (!result.view) {
    return editDashboardFailure(interaction, {
      title: 'Refresh needed',
      message: 'The player changed, but I could not refresh that Grimoire view.',
      suggestion: 'Refresh the dashboard, then open View Grimoire again.'
    })
  }

  return updateControlPayload(interaction, createPlayerGrimoirePayload(result.view, playerId, labels))
}

async function handleImpReplacementResult(interaction, context, result, playerId, labels) {
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  if (!result.view) return editDashboardSuccess(interaction, 'The Imp replacement was assigned.')
  return updateControlPayload(interaction, createPlayerGrimoirePayload(result.view, playerId, labels))
}

function normalizeGrimoireResultDeps(deps) {
  if (typeof deps === 'function') return { handleDashboardLifecycleResult: deps }
  return deps || {}
}

async function postManualRevealBoard(interaction, context, result, deps = {}) {
  const view = deps.gameLifecycle?.getGameView?.(interaction.guild.id) || result.view
  const revealId = view?.pendingEndReveal?.id || result.reveal?.id
  if (!view || !revealId) {
    return editDashboardFailure(interaction, {
      title: 'Reveal board not posted',
      message: 'The game-ending reveal was prepared, but I could not post the Grimoire reveal board.',
      suggestion: 'Check the post-game channel setup, then refresh the dashboard.'
    })
  }

  const revealLabels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, view)
  const posted = await postGrimRevealBoard({
    gameManager: deps.gameManager,
    interaction,
    labels: revealLabels,
    revealId,
    serverConfig: context.serverConfig,
    view
  })
  if (!posted.ok) {
    await rollbackUnpostedReveal(deps.gameLifecycle, interaction, revealId)
    return editRevealBoardFailure(interaction, posted)
  }

  trackRevealBoardMessage(view.pendingEndReveal || result.reveal, posted.message, deps.gameLifecycle)
  return editDashboardSuccess(interaction, 'Game-ending Grimoire reveal board posted. No roles were revealed automatically.')
}

async function moveStorytellerToPlayer(interaction, context, playerId, services) {
  if (isFakeDashboardPlayer(context, playerId)) {
    return editDashboardFailure(interaction, {
      title: 'Fake player',
      message: 'Fake test players do not have a real Discord voice cottage.',
      suggestion: 'Use this button with a real player during a live Discord game.'
    })
  }

  const targetMember = await fetchDashboardMember(interaction, playerId, 'grimoire-move-target-member')
  if (!targetMember) {
    return editDashboardFailure(interaction, {
      title: 'Player not found',
      message: 'I could not find that player in this server.',
      suggestion: 'Refresh the dashboard and try again.'
    })
  }

  const channel = await services.ensurePlayerNightVoiceChannel?.(interaction, context, targetMember)
  if (!channel) {
    return editDashboardFailure(interaction, {
      title: 'No cottage found',
      message: 'I could not create or find that player voice cottage.',
      suggestion: 'Try again during night, or use the Move screen.'
    })
  }

  const storytellerMember = await fetchDashboardMember(
    interaction,
    interaction.member.id,
    'grimoire-move-storyteller-member',
    interaction.member
  )
  if (!storytellerMember?.voice?.channelId) {
    return editDashboardFailure(interaction, {
      title: 'Join voice first',
      message: 'Join any voice channel first, then press Move again.',
      suggestion: 'Discord only lets the bot move you after you are already connected to voice.'
    })
  }

  if (storytellerMember.voice.channelId === channel.id) {
    await queuedVoiceMove(storytellerMember, channel)
      .catch(err => log.recoverable('refresh-grimoire-storyteller-move', err, { channelId: channel.id, guildId: interaction.guild.id, playerId, storytellerId: interaction.member.id }))
    return editDashboardSuccess(interaction, `You are already in <#${channel.id}>.`)
  }

  const moved = await queuedVoiceMove(storytellerMember, channel)
    .then(() => true)
    .catch(err => { log.recoverable('move-grimoire-storyteller-to-cottage', err, { channelId: channel.id, guildId: interaction.guild.id, playerId, storytellerId: interaction.member.id }); return false })

  return moved
    ? editDashboardSuccess(interaction, `Moved you to <#${channel.id}>.`)
    : editDashboardFailure(interaction, {
      title: 'Move failed',
      message: `I found <#${channel.id}>, but could not move you there.`,
      suggestion: 'Check bot voice permissions and try again.'
    })
}

module.exports = {
  createGrimoireButtonHandler,
  createImpReplacementChoicePayload,
  handleImpReplacementResult,
  handlePlayerGrimoireResult,
  moveStorytellerToPlayer,
  normalizeGrimoireResultDeps,
  postManualRevealBoard
}
