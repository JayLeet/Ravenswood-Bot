const {
  canCreatePlayerMadeVoiceChannel,
  ensurePlayerPrivateConversationVoiceChannel,
  isPrivateConversationCreationPhase
} = require('./dayPrivateConversations')
const {
  findPrivateConversationOwnerByChannel,
  getPrivateConversationAccess,
  removePrivateConversationAccess
} = require('./dayPrivateAccess')
const {
  createMovementSummary,
  movePlayerToVoiceChannel
} = require('./movement')
const {
  clearPlayerMadeVoiceState,
  deleteCleanupVoiceChannel
} = require('./dayPrivateConversationCleanup')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'DayPrivateVoiceRuntime' })

function createDayPrivateVoiceRuntime({
  client,
  gameLifecycle,
  createVoiceSyncContext,
  logMovementIssues,
  sendCreatorPrompt = null
}) {
  async function ensureRequestedPrivateConversation({
    discordClient,
    guildId,
    ownerId,
    invitedPlayerIds = [],
    movePlayerIds = [],
    publicRoom = false
  }) {
    const context = await createVoiceSyncContext(discordClient, guildId)
    if (!context) {
      return gameLifecycle.createError(
        gameLifecycle.errorTypes.INVALID_STATE,
        'Private voice channels are not ready for this game.'
      )
    }

    if (!isPrivateConversationCreationPhase(context.game.phase)) {
      return gameLifecycle.createError(
        gameLifecycle.errorTypes.INVALID_STATE,
        'Private voice chat is only available during the day.'
      )
    }

    if (gameLifecycle.getRole(context.game, ownerId) !== 'player') {
      return gameLifecycle.createError(gameLifecycle.errorTypes.PERMISSION_DENIED, 'Only players can create private voice chats.')
    }

    const currentAccess = getPrivateConversationAccess(context.game, ownerId)
    const allowedPlayerIds = [...new Set([
      ...currentAccess.invitedPlayerIds,
      ownerId,
      ...invitedPlayerIds
    ])]
    const invalidPlayerId = allowedPlayerIds.find(playerId =>
      gameLifecycle.getRole(context.game, playerId) !== 'player'
    )
    if (invalidPlayerId) {
      return gameLifecycle.createError(
        gameLifecycle.errorTypes.INVALID_STATE,
        'That private voice request is no longer valid.'
      )
    }

    const ownerMember = await fetchDayPrivateMember(context.guild, ownerId, 'fetch-day-private-owner')
    const channel = await ensurePlayerPrivateConversationVoiceChannel({
      guild: context.guild,
      parent: context.voiceParent,
      game: context.game,
      gameLifecycle,
      view: context.view,
      roleIds: context.roleIds,
      playerId: ownerId,
      discordMember: ownerMember,
      invitedPlayerIds: allowedPlayerIds,
      publicRoom
    })

    if (!channel) {
      return gameLifecycle.createError(gameLifecycle.errorTypes.TRANSACTION_FAILED, 'Could not create or update the private voice room.')
    }

    const movement = createMovementSummary()
    for (const playerId of [...new Set(movePlayerIds)]) {
      await movePlayerToVoiceChannel(context.guild, playerId, channel, movement)
    }
    logMovementIssues(guildId, 'private conversation voice', movement)
    gameLifecycle.save()

    return gameLifecycle.createSuccess({ channel, view: gameLifecycle.getGameView(guildId) })
  }

  async function handleVoiceStateUpdate(oldState, newState) {
    await handlePlayerMadeVoiceDeparture(oldState, newState)

    const guild = newState?.guild
    if (!guild || !newState.channelId) return

    const game = gameLifecycle.get(guild.id)
    if (!canCreatePlayerMadeVoiceChannel(game, newState.id)) return
    if (newState.channelId !== game.privateConversationCreatorChannelId) return

    const context = await createVoiceSyncContext(client, guild.id)
    if (!context) return

    const channel = await ensurePlayerPrivateConversationVoiceChannel({
      guild: context.guild,
      parent: context.voiceParent,
      game: context.game,
      gameLifecycle,
      view: context.view,
      roleIds: context.roleIds,
      playerId: newState.id,
      discordMember: newState.member || null
    })
    if (!channel) return

    const movement = createMovementSummary()
    await movePlayerToVoiceChannel(context.guild, newState.id, channel, movement)
    logMovementIssues(guild.id, 'private conversation voice', movement)
    await sendCreatorPrompt?.({
      channel,
      game: context.game,
      guild: context.guild,
      ownerId: newState.id
    })
  }

  async function handlePlayerMadeVoiceDeparture(oldState, newState) {
    if (!oldState?.guild || !oldState.channelId) return
    if (oldState.channelId === newState?.channelId) return

    const game = gameLifecycle.get(oldState.guild.id)
    const ownerId = findPrivateConversationOwnerByChannel(game, oldState.channelId)
    if (!ownerId) return

    const channel = oldState.channel || await fetchDepartedPlayerMadeVoiceChannel(oldState, game, gameLifecycle, ownerId)
    if (!channel) return

    if (isVoiceChannelEmpty(channel, oldState.id)) {
      const deleted = await deleteCleanupVoiceChannel(channel, log, 'delete-empty-player-made-day-voice-channel', 'BOTC empty player-made day voice cleanup', {
        playerId: ownerId,
        userId: oldState.id
      })
      if (!deleted) return

      clearPlayerMadeVoiceState({ game, gameLifecycle, guildId: oldState.guild.id, playerId: ownerId })
      gameLifecycle.save()
      return
    }

    const access = getPrivateConversationAccess(game, ownerId)
    if (access.publicRoom || !access.invitedPlayerIds.includes(oldState.id)) return

    const updated = removePrivateConversationAccess(game, ownerId, oldState.id)
    const context = await createVoiceSyncContext(client, oldState.guild.id)
    if (!context) return

    await ensurePlayerPrivateConversationVoiceChannel({
      guild: context.guild,
      parent: context.voiceParent,
      game: context.game,
      gameLifecycle,
      view: context.view,
      roleIds: context.roleIds,
      playerId: ownerId,
      invitedPlayerIds: updated.invitedPlayerIds,
      publicRoom: updated.publicRoom
    })
    gameLifecycle.save()
  }

  return {
    ensureRequestedPrivateConversation,
    handleVoiceStateUpdate
  }
}

async function fetchDepartedPlayerMadeVoiceChannel(oldState, game, gameLifecycle, ownerId) {
  if (!oldState.guild?.channels?.fetch) {
    log.recoverable('fetch-player-made-day-voice-channel-unavailable', new Error('Guild channel API unavailable'), {
      channelId: oldState.channelId,
      guildId: oldState.guild?.id,
      userId: oldState.id
    })
    return null
  }

  return oldState.guild.channels.fetch(oldState.channelId).catch(err => {
    if (isMissingChannelError(err)) {
      clearPlayerMadeVoiceState({ game, gameLifecycle, guildId: oldState.guild.id, playerId: ownerId })
      gameLifecycle.save()
      return null
    }

    log.recoverable('fetch-player-made-day-voice-channel', err, {
      channelId: oldState.channelId,
      guildId: oldState.guild.id,
      userId: oldState.id
    })
    return null
  })
}

function fetchDayPrivateMember(guild, userId, action) {
  return fetchGuildMemberWithRecoverableFallback({
    action,
    guild,
    logger: log,
    userId
  })
}

function isVoiceChannelEmpty(channel, leavingUserId) {
  const members = channel?.members
  if (!members) return false
  if (typeof members.filter === 'function') {
    return members.filter(member => member?.id !== leavingUserId && !member?.user?.bot).size === 0
  }
  if (typeof members.values !== 'function') return false
  return [...members.values()].filter(member => member?.id !== leavingUserId && !member?.user?.bot).length === 0
}

module.exports = {
  createDayPrivateVoiceRuntime
}
