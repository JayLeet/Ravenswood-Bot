const {
  createBotLogger
} = require('../../utils/logger')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../utils/discord/recoverableFetch')

function createMemberNicknameSync({
  client,
  gameLifecycle,
  gameManager,
  logger = undefined,
  clearTimeoutFn = clearTimeout,
  setTimeoutFn = setTimeout
}) {
  const pendingGuilds = new Map()
  const log = createBotLogger({ logger, subsystem: 'MemberNicknames' })
  let registered = false

  function registerMemberNicknameSync() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('GAME_ENDED', ({ game }) => clearGameNicknameSync(game?.guildId))

    gameLifecycle.events.on('PLAYER_LIFE_STATE_CHANGED', ({ game, playerId }) => {
      if (game?.guildId && playerId) syncMemberNickname(game, playerId)
    })

    for (const event of [
      'NOMINATION_CANCELLED',
      'NOMINATION_CREATED',
      'NOMINATION_SECONDED',
      'PERTINENCE_CHANGED',
      'VOTE_CAST',
      'VOTE_COUNTED',
      'VOTE_OPENED',
      'VOTE_PAUSED',
      'VOTE_RESOLVED',
      'EXECUTION_CANDIDATE_CHANGED',
      'PHASE_CHANGED'
    ]) {
      gameLifecycle.events.on(event, ({ game }) => scheduleGameNicknameSync(game))
    }

    return true
  }

  function scheduleGameNicknameSync(game) {
    if (!game?.guildId) return

    clearGameNicknameSync(game.guildId)

    const timeout = setTimeoutFn(() => {
      pendingGuilds.delete(game.guildId)
      return syncGameNicknames(game).catch(err => {
        log.recoverable('sync-game-nicknames', err, { guildId: game.guildId })
      })
    }, 0)
    if (typeof timeout.unref === 'function') timeout.unref()
    pendingGuilds.set(game.guildId, timeout)
  }

  function clearGameNicknameSync(guildId) {
    const existing = pendingGuilds.get(guildId)
    if (!existing) return false
    clearTimeoutFn(existing)
    pendingGuilds.delete(guildId)
    return true
  }

  async function syncGameNicknames(game) {
    const playerIds = gameLifecycle.getPlayerIds(game)
    for (const userId of playerIds) {
      if (game.users?.[userId]?.fake) continue
      await syncMemberNickname(game, userId)
    }
  }

  async function syncMemberNickname(game, userId) {
    const guild = client.guilds.cache.get(game.guildId) ||
      await client.guilds.fetch(game.guildId).catch(err => {
        log.recoverable('fetch-guild', err, { guildId: game.guildId })
        return null
      })
    if (!guild) return

    const member = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-member-nickname-sync',
      guild,
      logger: log,
      userId
    })
    if (!member) return

    await gameManager.setGameNickname(member, game, userId)
  }

  return {
    clearGameNicknameSync,
    registerMemberNicknameSync,
    getRuntimeState: () => ({
      pendingGuilds: pendingGuilds.size
    }),
    pendingGuildsSize: () => pendingGuilds.size,
    scheduleGameNicknameSync,
    syncGameNicknames,
    syncMemberNickname
  }
}

module.exports = {
  createMemberNicknameSync
}
