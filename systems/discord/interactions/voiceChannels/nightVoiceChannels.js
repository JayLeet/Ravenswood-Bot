const {
  queuedChannelDelete
} = require('../../../../utils/discord/channelActions')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  createFakeMember
} = require('../fakeMembers')
const {
  createMovementSummary,
  movePlayerToVoiceChannel
} = require('./movement')
const {
  ensurePlayerNightArea,
  positionNightChannelPairs
} = require('../nightArea')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../../utils/logger')

const NIGHT_AREA_CONCURRENCY = 3
const NIGHT_VOICE_REF_UNAVAILABLE = Symbol('night-voice-ref-unavailable')
const log = createBotLogger({ subsystem: 'NightVoiceChannels' })

async function ensureNightVoiceChannels({
  discordClient,
  guild,
  parent,
  game,
  gameLifecycle,
  view,
  roleIds,
  options = {}
}) {
  const channels = new Map()
  const movement = createMovementSummary()
  const playerIds = gameLifecycle.getPlayerIds(game)
  const tasks = playerIds.map(playerId => async () => {
    const isFake = isFakeNightVoicePlayer(gameLifecycle, game, playerId)
    const member = isFake
      ? createFakeMember(playerId, view)
      : await fetchNightVoiceMember(guild, playerId)
    if (!member) return

    const area = await ensurePlayerNightArea({
      discordClient,
      guild,
      parent,
      game,
      gameLifecycle,
      member,
      view,
      roleIds,
      positionImmediately: false
    })
    if (!area.voiceChannel) return

    channels.set(playerId, area.voiceChannel)
    if (options.movePlayers && !isFake && (!options.onlyUserId || options.onlyUserId === playerId)) {
      await movePlayerToVoiceChannel(guild, playerId, area.voiceChannel, movement)
    }
  })

  await runLimited(tasks, NIGHT_AREA_CONCURRENCY)
  await positionNightChannelPairs(guild, game, playerIds)
  await pruneExtraNightVoiceChannels(guild, game, gameLifecycle, new Set(playerIds))
  return { channels, movement }
}

function getRealPlayerIds(gameLifecycle, game) {
  return gameLifecycle.getPlayerIds(game)
    .filter(playerId => !isFakeNightVoicePlayer(gameLifecycle, game, playerId))
}

function isFakeNightVoicePlayer(gameLifecycle, game, playerId) {
  return gameLifecycle.isFakePlayer?.(game, playerId) === true ||
    game?.users?.[playerId]?.fake === true ||
    /^(test-player-|fake[_-])/.test(String(playerId || ''))
}

async function pruneExtraNightVoiceChannels(guild, game, gameLifecycle, playerIds) {
  for (const [playerId, channelId] of Object.entries(game.nightVoiceChannels || {})) {
    if (playerIds.has(playerId)) continue

    const cleaned = await cleanupExtraNightVoiceChannel(guild, channelId, playerId)
    if (!cleaned) continue

    gameLifecycle.unregisterNightVoiceChannel(guild.id, playerId)
  }
}

async function cleanupExtraNightVoiceChannel(guild, channelId, playerId) {
  const channel = await fetchExtraNightVoiceChannel(guild, channelId, playerId)
  if (channel === NIGHT_VOICE_REF_UNAVAILABLE) return false
  if (!channel) return true

  return queuedChannelDelete(channel, 'BOTC player no longer in game').then(() => true).catch(err => {
    if (isMissingChannelError(err)) return true
    log.recoverable('delete-extra-night-voice-channel', err, {
      channelId,
      guildId: guild.id,
      playerId
    })
    return false
  })
}

async function fetchExtraNightVoiceChannel(guild, channelId, playerId) {
  if (!guild?.channels?.fetch) {
    log.recoverable('fetch-extra-night-voice-channel-unavailable', new Error('Guild channel API unavailable'), {
      channelId,
      guildId: guild?.id,
      playerId
    })
    return NIGHT_VOICE_REF_UNAVAILABLE
  }

  return guild.channels.fetch(channelId).catch(err => {
    if (isMissingChannelError(err)) return null
    log.recoverable('fetch-extra-night-voice-channel', err, {
      channelId,
      guildId: guild.id,
      playerId
    })
    return NIGHT_VOICE_REF_UNAVAILABLE
  })
}

function fetchNightVoiceMember(guild, playerId) {
  return fetchGuildMemberWithRecoverableFallback({
    action: 'fetch-night-voice-member',
    guild,
    logger: log,
    userId: playerId
  })
}

async function runLimited(tasks, limit) {
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, tasks.length)) },
    async (_, workerIndex) => {
      for (let index = workerIndex; index < tasks.length; index += limit) {
        await tasks[index]()
      }
    }
  )

  await Promise.all(workers)
}

module.exports = {
  ensureNightVoiceChannels,
  getRealPlayerIds,
  isFakeNightVoicePlayer,
  runLimited
}
