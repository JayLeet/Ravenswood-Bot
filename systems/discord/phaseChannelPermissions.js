const {
  OverwriteType
} = require('discord.js')
const {
  getGameRoles
} = require('../../utils/setupTextChannelPermissions')
const {
  editPermissionOverwrite
} = require('../../utils/discord/permissionOverwriteActions')
const {
  createBotLogger
} = require('../../utils/logger')

function createPhaseChannelPermissionSystem({
  client,
  gameLifecycle,
  gameManager,
  isSetupComplete,
  serverConfigs
}) {
  const log = createBotLogger({ subsystem: 'PhaseChannelPermissions' })
  let registered = false

  function registerPhaseChannelPermissions() {
    if (registered) return false
    registered = true

    const permissionEvents = [
      'GAME_CREATED',
      'GAME_STARTED',
      'PHASE_CHANGED',
      'NOMINATION_CANCELLED',
      'NOMINATION_CREATED',
      'PLAYER_JOINED',
      'PLAYER_LEFT',
      'PLAYER_LIFE_STATE_CHANGED',
      'VOTE_OPENED',
      'VOTE_PAUSED',
      'VOTE_RESOLVED'
    ]

    for (const event of permissionEvents) {
      gameLifecycle.events.on(event, async ({ game }) => {
        if (!game?.guildId) return

        await recover(log, 'apply-phase-permissions-event', () => applyPhaseChannelPermissions(client, game.guildId), {
          event,
          guildId: game.guildId
        })
      })
    }

    gameLifecycle.events.on('GAME_ENDED', async ({ game }) => {
      if (!game?.guildId) return

      await recover(log, 'reset-phase-permissions-event', () => resetGameChannelPermissions(client, game.guildId, game), {
        event: 'GAME_ENDED',
        guildId: game.guildId
      })
    })

    return true
  }

  async function applyPhaseChannelPermissions(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return

    const game = gameLifecycle.get(guildId)
    if (!game) return

    await setPostGameStorytellerView(discordClient, guildId, serverConfig, gameManager, false, log)
    await setWaitingRoomPlayerAccess(
      discordClient,
      guildId,
      serverConfig,
      gameManager,
      game.state === 'in-game',
      log
    )

    const liveChannel = await recover(log, 'fetch-live-channel-for-phase-permissions', () =>
      discordClient.channels.fetch(serverConfig.liveChannelId), {
      channelId: serverConfig.liveChannelId,
      guildId
    })

    if (!liveChannel?.isTextBased() || !liveChannel.permissionOverwrites) return

    const playerIds = gameLifecycle.getPlayerIds(game)

    for (const userId of playerIds) {
      const messagePermission = getLiveChatMessagePermission(game, userId)

      await recover(log, 'edit-live-channel-player-permissions', () => editPermissionOverwrite(liveChannel, userId, {
        SendMessages: messagePermission,
        SendMessagesInThreads: messagePermission
      }, { type: OverwriteType.Member }), {
        channelId: liveChannel.id,
        guildId,
        userId
      })
    }
  }

  async function resetGameChannelPermissions(discordClient, guildId, game) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return

    await setPostGameStorytellerView(discordClient, guildId, serverConfig, gameManager, true, log)
    await setWaitingRoomPlayerAccess(discordClient, guildId, serverConfig, gameManager, false, log)

    const liveChannel = await recover(log, 'fetch-live-channel-for-phase-permission-reset', () =>
      discordClient.channels.fetch(serverConfig.liveChannelId), {
      channelId: serverConfig.liveChannelId,
      guildId
    })

    if (!liveChannel?.isTextBased() || !liveChannel.permissionOverwrites) return

    for (const userId of Object.keys(game.users || {})) {
      await recover(log, 'reset-live-channel-player-permissions', () => editPermissionOverwrite(liveChannel, userId, {
        SendMessages: null,
        SendMessagesInThreads: null
      }, { type: OverwriteType.Member }), {
        channelId: liveChannel.id,
        guildId,
        userId
      })
    }
  }

  return {
    applyPhaseChannelPermissions,
    registerPhaseChannelPermissions,
    resetGameChannelPermissions
  }
}

async function recover(log, action, fn, context = {}) {
  try {
    return await fn()
  } catch (err) {
    log?.recoverable?.(action, err, context)
    return null
  }
}

async function setPostGameStorytellerView(discordClient, guildId, serverConfig, gameManager, canView, log = null) {
  const guild = discordClient.guilds.cache.get(guildId) ||
    await recover(log, 'fetch-guild-for-post-game-storyteller-view', () => discordClient.guilds.fetch(guildId), {
      guildId
    })
  const channel = await recover(log, 'fetch-post-game-channel-for-storyteller-view', () =>
    discordClient.channels.fetch(serverConfig.postGameChannelId), {
    channelId: serverConfig.postGameChannelId,
    guildId
  })

  if (!guild || !channel?.isTextBased?.() || !channel.permissionOverwrites) return false
  if (!gameManager?.roleNames?.storyteller) return false

  const storytellerRole = getGameRoles(guild, gameManager).storyteller
  if (!storytellerRole?.id) return false

  const permissions = canView
    ? {
        ViewChannel: true,
        SendMessages: true,
        SendMessagesInThreads: true,
        ReadMessageHistory: true,
        UseApplicationCommands: true
      }
    : { ViewChannel: false }

  const result = await recover(log, 'edit-post-game-storyteller-view', () =>
    editPermissionOverwrite(channel, storytellerRole.id, permissions, { type: OverwriteType.Role }), {
    channelId: channel.id,
    guildId,
    roleId: storytellerRole.id
  })
  return result !== null
}

async function setWaitingRoomPlayerAccess(discordClient, guildId, serverConfig, gameManager, hidePlayerRole, log = null) {
  if (!serverConfig?.waitingRoomVoiceChannelId) return false

  const guild = discordClient.guilds.cache.get(guildId) ||
    await recover(log, 'fetch-guild-for-waiting-room-player-access', () => discordClient.guilds.fetch(guildId), {
      guildId
    })
  const channel = await recover(log, 'fetch-waiting-room-for-player-access', () =>
    discordClient.channels.fetch(serverConfig.waitingRoomVoiceChannelId), {
    channelId: serverConfig.waitingRoomVoiceChannelId,
    guildId
  })

  if (!guild || !channel?.permissionOverwrites) return false
  if (!gameManager?.roleNames?.player) return false

  const playerRole = getGameRoles(guild, gameManager).player
  if (!playerRole?.id) return false

  const permissions = hidePlayerRole
    ? { ViewChannel: false, Connect: false }
    : { ViewChannel: null, Connect: null }

  const result = await recover(log, 'edit-waiting-room-player-access', () =>
    editPermissionOverwrite(channel, playerRole.id, permissions, { type: OverwriteType.Role }), {
    channelId: channel.id,
    guildId,
    roleId: playerRole.id
  })
  return result !== null
}

async function revealPostGameChannelToStoryteller(discordClient, guildId, serverConfig, gameManager) {
  return setPostGameStorytellerView(discordClient, guildId, serverConfig, gameManager, true)
}

function getLiveChatMessagePermission(game, userId) {
  const nomination = getActiveNomination(game)
  if (!nomination) return null
  if (nomination.status === 'voting') return false

  if (nomination.status === 'pending_second' || nomination.status === 'seconded') {
    return [nomination.nominatorId, nomination.nomineeId].includes(userId) ? null : false
  }

  return null
}

function getActiveNomination(game) {
  return [...(game.nominations || [])]
    .reverse()
    .find(nomination => ['pending_second', 'seconded', 'voting'].includes(nomination.status)) || null
}

module.exports = {
  createPhaseChannelPermissionSystem,
  getActiveNomination,
  getLiveChatMessagePermission,
  revealPostGameChannelToStoryteller,
  setPostGameStorytellerView,
  setWaitingRoomPlayerAccess
}
