const {
  cleanupPlayerMadeVoiceChannels,
  ensurePrivateConversationCreatorChannel,
  isPrivateConversationCreationPhase,
  prunePlayerMadeVoiceChannels
} = require('./voiceChannels/dayPrivateConversations')
const {
  createDayPrivateVoiceRuntime
} = require('./voiceChannels/dayPrivateRuntime')
const {
  sendPrivateVoiceCreatorPrompt
} = require('./privateVoiceRequestActions')
const {
  ensurePublicDaySideVoiceChannels,
  ensureStorytellerDenVoiceChannel: ensureStorytellerDen,
  ensureTownsquareVoiceChannel
} = require('./voiceChannels/dayPublicChannels')
const {
  movePlayersToVoiceChannel
} = require('./voiceChannels/movement')
const {
  ensureNightVoiceChannels,
  getRealPlayerIds,
  runLimited
} = require('./voiceChannels/nightVoiceChannels')
const {
  getGameVoiceRoleIds
} = require('./voiceChannels/roles')
const {
  hideNightAreas
} = require('./nightArea/visibility')
const {
  createBotLogger
} = require('../../../utils/logger')

function isPublicDayVoicePhase(phase) {
  return phase === 'day' || phase === 'nominations'
}

function createGameVoiceChannelSystem({
  client,
  gameLifecycle,
  gameManager,
  serverConfigs,
  isSetupComplete,
  ensureConfiguredGuildReady,
  findNightChannelParent
}) {
  const log = createBotLogger({ subsystem: 'VoiceChannels' })
  const dayPrivateVoice = createDayPrivateVoiceRuntime({
    client,
    gameLifecycle,
    createVoiceSyncContext,
    logMovementIssues,
    sendCreatorPrompt: sendPrivateVoiceCreatorPrompt
  })
  let registered = false

  function registerGameVoiceChannels() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('GAME_STARTED', async ({ game }) => {
      if (!game?.guildId) return
      await syncGameVoiceChannels(client, game.guildId, { movePlayers: true }).catch(logSyncError)
    })

    gameLifecycle.events.on('PHASE_CHANGED', async ({ game, to }) => {
      if (!game?.guildId) return
      await syncGameVoiceChannels(client, game.guildId, {
        movePlayers: to === 'night' || isPublicDayVoicePhase(to)
      }).catch(logSyncError)
    })

    gameLifecycle.events.on('PLAYER_JOINED', async ({ game, member }) => {
      if (!game?.guildId) return
      await syncGameVoiceChannels(client, game.guildId, {
        movePlayers: true,
        onlyUserId: member?.id || null
      }).catch(logSyncError)
    })

    for (const event of getPermissionOnlyEvents()) {
      gameLifecycle.events.on(event, async ({ game }) => {
        if (!game?.guildId) return
        await syncGameVoiceChannels(client, game.guildId).catch(logSyncError)
      })
    }

    client.on('voiceStateUpdate', async (oldState, newState) => {
      await dayPrivateVoice.handleVoiceStateUpdate(oldState, newState).catch(err => {
        log.recoverable('handle-private-conversation-voice-state', err, {
          guildId: newState?.guild?.id || oldState?.guild?.id,
          userId: newState?.member?.id || oldState?.member?.id
        })
      })
    })

    return true
  }

  async function syncGameVoiceChannels(discordClient, guildId, options = {}) {
    const context = await createVoiceSyncContext(discordClient, guildId)
    if (!context) return 0

    const { guild, game, nightParent, roleIds, view, voiceParent } = context
    let touched = 0

    const den = await ensureStorytellerDenVoiceChannelFromContext(context)
    if (den) touched += 1

    if (game.phase === 'night') {
      const { channels, movement } = await ensureNightVoiceChannels({
        discordClient,
        guild,
        parent: nightParent,
        game,
        gameLifecycle,
        view,
        roleIds,
        options
      })
      touched += channels.size
      if (options.movePlayers) logMovementIssues(guild.id, 'night cottages', movement)
      touched += await cleanupPlayerMadeVoiceChannels({ guild, game, gameLifecycle, includeCreator: false })
      return touched
    }

    if (isPublicDayVoicePhase(game.phase)) {
      touched += await syncPublicDayVoiceChannels(guild, voiceParent, game, roleIds, options)
    } else {
      touched += await cleanupPlayerMadeVoiceChannels({ guild, game, gameLifecycle, includeCreator: false })
    }

    return touched
  }

  async function ensureStorytellerDenVoiceChannel(interaction) {
    const context = await createVoiceSyncContext(interaction.client, interaction.guild.id)
    if (!context) return null
    return ensureStorytellerDenVoiceChannelFromContext(context)
  }

  async function ensureStorytellerDenVoiceChannelFromContext(context) {
    return ensureStorytellerDen({
      guild: context.guild,
      parent: context.voiceParent,
      gameLifecycle,
      roleIds: context.roleIds
    })
  }

  async function createVoiceSyncContext(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const game = gameLifecycle.get(guildId)
    if (!game || game.state !== 'in-game') return null
    const view = gameLifecycle.getGameView(guildId)
    if (!view) return null

    const guild = discordClient.guilds.cache.get(guildId) ||
      await discordClient.guilds.fetch(guildId).catch(err => {
        log.recoverable('fetch-voice-sync-guild', err, { guildId })
        return null
      })
    if (!guild) return null

    const readiness = await ensureConfiguredGuildReady(discordClient, guild, serverConfig)
    if (!readiness.ok) return null

    const nightParent = await findNightChannelParent(discordClient, guild, serverConfig)
    const voiceParent = await findGameVoiceChannelParent(discordClient, serverConfig, log) || nightParent

    return {
      guild,
      game,
      nightParent,
      roleIds: await getGameVoiceRoleIds(guild, gameManager),
      view,
      voiceParent
    }
  }

  async function syncPublicDayVoiceChannels(guild, parent, game, roleIds, options) {
    let touched = 0
    const townsquare = await ensureTownsquareVoiceChannel({ guild, parent, gameLifecycle, roleIds })
    if (townsquare) touched += 1

    const sideRooms = await ensurePublicDaySideVoiceChannels({ guild, parent, gameLifecycle, roleIds })
    touched += sideRooms.length

    if (isPrivateConversationCreationPhase(game.phase)) {
      const creator = await ensurePrivateConversationCreatorChannel({ guild, parent, game, gameLifecycle, roleIds })
      if (creator) touched += 1
      touched += await prunePlayerMadeVoiceChannels({
        guild,
        game,
        gameLifecycle,
        playerIds: gameLifecycle.getPlayerIds(game)
      })
    } else {
      touched += await cleanupPlayerMadeVoiceChannels({ guild, game, gameLifecycle, includeCreator: false })
    }

    if (townsquare && options.movePlayers) {
      const movement = await movePlayersToVoiceChannel(
        guild,
        getRealPlayerIds(gameLifecycle, game),
        townsquare,
        options.onlyUserId || null
      )
      logMovementIssues(guild.id, 'public day voice', movement)
    }

    touched += await hideNightAreas({ guild, game, botUserId: guild.client.user.id })
    gameLifecycle.save()
    return touched
  }

  function logMovementIssues(guildId, target, movement) {
    if (!movement) return

    if (movement.missingChannel.length) {
      log.warn('missing-voice-channels', 'Some players had no target voice channel.', {
        guildId,
        players: movement.missingChannel.join(','),
        target
      })
    }

    if (movement.failed.length) {
      const failed = movement.failed.map(item => `${item.playerId}: ${item.reason}`).join('; ')
      log.warn('failed-voice-moves', 'Some players could not be moved.', {
        failed,
        guildId,
        target
      })
    }
  }

  return {
    ensureRequestedPrivateConversation: dayPrivateVoice.ensureRequestedPrivateConversation,
    ensureStorytellerDenVoiceChannel,
    registerGameVoiceChannels,
    syncGameVoiceChannels
  }
}

async function findGameVoiceChannelParent(discordClient, serverConfig, logger = null) {
  const channelIds = [
    serverConfig.storytellerChannelId,
    serverConfig.liveChannelId,
    serverConfig.spectatorChannelId,
    serverConfig.gameChannelId
  ]

  for (const channelId of channelIds) {
    if (!channelId) continue
    if (!discordClient?.channels?.fetch) {
      logger?.recoverable?.('fetch-game-voice-parent-source-channel-unavailable', new Error('Discord client channel API unavailable'), { channelId })
      return null
    }

    const channel = await discordClient.channels.fetch(channelId).catch(err => {
      logger?.recoverable?.('fetch-game-voice-parent-source-channel', err, { channelId })
      return null
    })
    if (channel?.parent) return channel.parent
  }

  return null
}

function getPermissionOnlyEvents() {
  return [
    'ADMIN_USER_REMOVED',
    'PLAYER_LEFT',
    'PLAYER_LIFE_STATE_CHANGED',
    'PLAYER_SPECTATED',
    'STORYTELLER_CHANGED'
  ]
}

function logSyncError(err) {
  createBotLogger({ subsystem: 'VoiceChannels' }).recoverable('sync-game-voice-channels', err)
}

module.exports = {
  createGameVoiceChannelSystem,
  isPublicDayVoicePhase,
  runLimited
}
