const {
  STORYTELLER_PLAYER_ACTIONS,
  createNightTargetPromptPayload
} = require('../../embeds')
const {
  queuedVoiceMove
} = require('../../../../utils/discord/voiceActions')
const {
  sendOrEditNightPromptMessage
} = require('../nightPromptMessages')
const {
  createFakeMember
} = require('../fakeMembers')
const {
  formatDashboardPlayer,
  isFakeDashboardPlayer
} = require('./fakePlayers')
const {
  fetchDashboardMember
} = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'StorytellerPlayerActions' })

function createStorytellerPlayerActionRunner({
  gameLifecycle,
  services,
  getDashboardPlayerLabels
}) {
  async function run(interaction, context, action, playerId) {
    if (action === STORYTELLER_PLAYER_ACTIONS.nominate) {
      const result = await gameLifecycle.createNomination(
        interaction.guild.id,
        interaction.member,
        playerId,
        { manualStorytellerNomination: true }
      )

      return {
        result,
        message: `Created a manual nomination for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.storytellerTarget) {
      const result = await gameLifecycle.createNomination(
        interaction.guild.id,
        interaction.member,
        context.view.storytellerId,
        { nominatorId: playerId }
      )

      return {
        result,
        message: result.ok ? 'Created the Storyteller nomination.' : null
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.openVote) {
      const result = await gameLifecycle.openVote(interaction.guild.id, interaction.member, playerId)

      if (result.ok) {
        await services.postOrUpdateVotingPanel(interaction.client, interaction.guild.id, result.nomination, result.view)
      }

      return {
        result,
        message: `Opened voting for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.resolveVote) {
      const result = await gameLifecycle.resolveVote(interaction.guild.id, interaction.member, playerId)

      if (result.ok && result.nomination && result.view) {
        await services.postOrUpdateVotingPanel(interaction.client, interaction.guild.id, result.nomination, result.view)
      }

      return {
        result,
        message: result.ok
          ? result.markedForExecution
            ? `${formatDashboardPlayer(context, playerId)} is marked for execution.`
            : 'Vote resolved.'
          : null,
        liveMessage: result.ok ? result.publicMessage : null
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.markExecutionCandidate) {
      return {
        result: gameLifecycle.markExecutionCandidate(interaction.guild.id, interaction.member, playerId),
        message: `Marked ${formatDashboardPlayer(context, playerId)} for execution.`,
        liveMessage: `${formatDashboardPlayer(context, playerId)} is on the block.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.clearRole) {
      return {
        result: await gameLifecycle.clearScriptRole(interaction.guild.id, interaction.member, playerId),
        message: `Cleared the role for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.kill) {
      return {
        result: await gameLifecycle.killPlayer(interaction.guild.id, interaction.member, playerId),
        message: `Marked ${formatDashboardPlayer(context, playerId)} dead.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.revive) {
      return {
        result: await gameLifecycle.revivePlayer(interaction.guild.id, interaction.member, playerId),
        message: `Marked ${formatDashboardPlayer(context, playerId)} alive.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.poisoned) {
      return {
        result: await gameLifecycle.setPlayerStatus(interaction.guild.id, interaction.member, playerId, 'poisoned'),
        message: `Marked ${formatDashboardPlayer(context, playerId)} poisoned.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.drunk) {
      return {
        result: await gameLifecycle.setPlayerStatus(interaction.guild.id, interaction.member, playerId, 'drunk'),
        message: `Marked ${formatDashboardPlayer(context, playerId)} drunk.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.protected) {
      return {
        result: await gameLifecycle.setPlayerStatus(interaction.guild.id, interaction.member, playerId, 'protected'),
        message: `Marked ${formatDashboardPlayer(context, playerId)} protected.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.evilTwin) {
      return {
        result: await gameLifecycle.setPlayerStatus(interaction.guild.id, interaction.member, playerId, 'evil_twin'),
        message: `Marked ${formatDashboardPlayer(context, playerId)} evil twin.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.redHerring) {
      return {
        result: await gameLifecycle.setPlayerStatus(interaction.guild.id, interaction.member, playerId, 'red_herring'),
        message: `Marked ${formatDashboardPlayer(context, playerId)} red herring.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.clearStatus) {
      return {
        result: await gameLifecycle.clearPlayerStatus(interaction.guild.id, interaction.member, playerId),
        message: `Cleared status markers for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.triggerReminder) {
      return {
        result: await gameLifecycle.triggerReminder(interaction.guild.id, interaction.member, playerId),
        message: `Triggered the latest reminder for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.resolveNightAction) {
      const result = await gameLifecycle.resolveLatestNightAction(interaction.guild.id, interaction.member, playerId)

      return {
        result,
        message: result.ok && result.roleResult?.suggestedInfo
          ? `Resolved the night action for ${formatDashboardPlayer(context, playerId)}. Suggested info is ready; use Send secret info to review, edit, and deliver it.`
          : `Resolved the latest submitted target choice for ${formatDashboardPlayer(context, playerId)}.`
      }
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.visitCottage) {
      return visitCottage(interaction, context, playerId)
    }

    if (action === STORYTELLER_PLAYER_ACTIONS.wake) {
      return wakePlayer(interaction, context, playerId)
    }

    return {
      result: {
        ok: false,
        error: {
          message: 'Unknown dashboard action.'
        }
      }
    }
  }

  async function visitCottage(interaction, context, playerId) {
    if (context.game.phase !== 'night') {
      return createActionError('Storyteller cottage visits are only available during night.')
    }

    if (isFakeDashboardPlayer(context, playerId)) {
      return createActionError('Fake test players do not have a real Discord voice cottage to visit.')
    }

    const targetMember = await fetchDashboardMember(interaction, playerId, 'fetch-visit-cottage-member')
    if (!targetMember) return createActionError('I could not find that player in this server.')

    const channel = await services.ensurePlayerNightVoiceChannel?.(interaction, context, targetMember)
    if (!channel) return createActionError('I could not create or find that player night voice cottage.')

    const storytellerMember = await fetchDashboardMember(
      interaction,
      interaction.member.id,
      'fetch-visit-cottage-storyteller-member',
      interaction.member
    )
    if (!storytellerMember?.voice?.channelId) {
      return createActionError('Join any voice channel first, then use Visit cottage again.')
    }

    const moved = await queuedVoiceMove(storytellerMember, channel)
      .then(() => true)
      .catch(err => { log.recoverable('move-storyteller-to-cottage', err, { channelId: channel.id, guildId: interaction.guild.id, playerId, storytellerId: interaction.member.id }); return false })

    if (!moved) return createActionError(`I found ${channel.name}, but could not move you there.`)

    return {
      result: { ok: true },
      message: `Moved you to ${formatDashboardPlayer(context, playerId)}'s cottage.`
    }
  }

  async function wakePlayer(interaction, context, playerId) {
    const targetMember = isFakeDashboardPlayer(context, playerId)
      ? createFakeMember(playerId, context.view)
      : await fetchDashboardMember(interaction, playerId, 'fetch-wake-player-member')

    if (!targetMember) {
      return createActionError('I could not find that player in this server.')
    }

    const channel = await services.ensurePlayerNightChannel(interaction, context, targetMember)

    if (!channel) {
      return createActionError('I could not create or find that player private night channel.')
    }

    const result = await gameLifecycle.recordPlayerWake(interaction.guild.id, interaction.member, playerId)
    if (!result.ok) return { result }

    const playerLabels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
    const sent = await sendOrEditNightPromptMessage({
      action: result.action,
      channel,
      client: interaction.client,
      game: context.game,
      gameLifecycle,
      guildId: interaction.guild.id,
      logger: log,
      payload: createNightTargetPromptPayload({
        action: result.action,
        actorId: playerId,
        players: result.view.users.players,
        playerLabels,
        view: result.view
      }),
      playerId
    }).then(delivered => Boolean(delivered?.message)).catch(err => { log.recoverable('send-storyteller-wake-night-prompt', err, { guildId: interaction.guild.id, playerId }); return false })

    if (!sent) {
      return createActionError(`I created <#${channel.id}>, but could not post the night action prompt there.`)
    }

    return {
      result,
      message: `Woke ${formatDashboardPlayer(context, playerId)} in <#${channel.id}>.`
    }
  }

  return { run }
}

function createActionError(message) {
  return {
    result: {
      ok: false,
      error: { message }
    }
  }
}

module.exports = {
  createStorytellerPlayerActionRunner
}
