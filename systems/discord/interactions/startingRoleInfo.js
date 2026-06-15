const { createFakeMember } = require('./fakeMembers')
const { ensurePlayerNightArea } = require('./nightArea')
const { createNightAreaRoleIds } = require('./nightArea/roleIds')
const { shouldSendStartingRoleInfo } = require('./startingRoleInfoRecipients')
const { ensureLunaticInfo } = require('../../../utils/lunaticInfo')
const { sendOrEditNightPromptMessage } = require('./nightPromptMessages')
const { createBotLogger } = require('../../../utils/logger')
const { fetchGuildMemberWithRecoverableFallback } = require('../../../utils/discord/recoverableFetch')
const {
  FALLBACK_ABILITY,
  createMentionedStartingRolePayload,
  createStartingRoleCountInfo,
  createStartingRoleInfoButtonRow,
  createStartingRoleInfoPayload,
  createStartingRoleLabel,
  createStartingRoleTeamInfo
} = require('./startingRoleInfoPayload')

function createStartingRoleInfoSystem({
  client,
  serverConfigs,
  gameLifecycle,
  isSetupComplete,
  findNightChannelParent,
  gameManager = null,
  setTimeoutFn = setTimeout
}) {
  const scheduledGuilds = new Map()
  const deliveringGuilds = new Map()
  const log = createBotLogger({ subsystem: 'StartingRoleInfo' })
  let registered = false

  function registerStartingRoleInfoDispatch() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('GAME_STARTED', ({ game }) => {
      scheduleStartingRoleInfo(client, game.guildId)
    })
    gameLifecycle.events.on('PHASE_CHANGED', ({ game, to }) => {
      if (to !== 'night') return undefined
      scheduleStartingRoleInfo(client, game.guildId)
      return undefined
    })
    gameLifecycle.events.on('GAME_ENDED', ({ game }) => {
      if (!game?.guildId) return
      scheduledGuilds.delete(game.guildId)
      deliveringGuilds.delete(game.guildId)
    })

    return true
  }

  async function deliverStartingRoleInfo(discordClient, guildId) {
    if (deliveringGuilds.has(guildId)) return 0
    const token = Symbol(guildId)
    deliveringGuilds.set(guildId, token)
    try {
      return await sendStartingRoleInfo(discordClient, guildId)
    } catch (err) {
      log.recoverable('deliver-starting-role-info', err, { guildId })
      return 0
    } finally {
      if (deliveringGuilds.get(guildId) === token) deliveringGuilds.delete(guildId)
    }
  }

  function scheduleStartingRoleInfo(discordClient, guildId) {
    if (!guildId) return false
    if (scheduledGuilds.has(guildId)) return false
    const token = Symbol(guildId)
    scheduledGuilds.set(guildId, token)
    setTimeoutFn(() => {
      if (scheduledGuilds.get(guildId) !== token) return
      return deliverStartingRoleInfo(discordClient, guildId).finally(() => {
        if (scheduledGuilds.get(guildId) === token) scheduledGuilds.delete(guildId)
      })
    }, 0)
    return true
  }

  async function sendStartingRoleInfo(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return 0

    const game = gameLifecycle.get(guildId)
    const view = gameLifecycle.getGameView(guildId)
    if (!view || !isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) return 0

    const guild = discordClient.guilds.cache.get(guildId) ||
      await discordClient.guilds.fetch(guildId).catch(err => { log.recoverable('fetch-starting-role-info-guild', err, { guildId }); return null })
    if (!guild) return 0

    const parent = await findNightChannelParent(discordClient, guild, serverConfig)
    const roleIds = createNightAreaRoleIds(guild, gameManager)
    let sent = 0

    for (const playerId of getStartingRoleInfoRecipients(game)) {
      if (!isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) break

      ensureLunaticInfo(game, playerId, gameLifecycle.scripts)
      const playerView = gameLifecycle.getGameView(guildId) || view
      const fakePlayer = gameLifecycle.isFakePlayer(game, playerId)
      const member = fakePlayer
        ? createFakeMember(playerId, playerView)
        : await fetchGuildMemberWithRecoverableFallback({
          action: 'fetch-starting-role-info-member',
          guild,
          logger: log,
          userId: playerId
        })
      if (!member) continue
      if (!isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) break

      const area = await ensurePlayerNightArea({
        discordClient,
        guild,
        parent,
        game,
        gameLifecycle,
        member,
        view: playerView,
        roleIds
      })
      const channel = area?.textChannel
      if (!channel) continue
      if (!isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) break

      const shownRoleId = getStartingRoleInfoRoleId(game, playerId)
      const role = gameLifecycle.scripts.getRole(game.scriptId, shownRoleId)
      const payload = createMentionedStartingRolePayload(
        createStartingRoleInfoPayload(role, game.guildId, playerId, {
          allowFakePlayerControls: fakePlayer && game.testMode === true,
          fakePlayer,
          view: playerView
        }),
        playerId,
        { fakePlayer }
      )
      const delivered = await sendOrEditNightPromptMessage({
        action: createStartingRoleInfoAction(game, playerId),
        channel,
        client: discordClient,
        game,
        gameLifecycle: createStartingRoleInfoRecorder(gameLifecycle, game, guildId),
        guildId,
        logger: log,
        payload,
        playerId
      }).then(result => Boolean(result?.message)).catch(err => { log.recoverable('send-starting-role-info-message', err, { guildId, playerId }); return false })

      if (!delivered || !isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) continue
      game.roleInfoSent ??= {}
      game.roleInfoSent[playerId] = Date.now()
      sent += 1
    }

    if (sent) gameLifecycle.save()
    return sent
  }

  function getRuntimeState() {
    return {
      deliveringGuilds: deliveringGuilds.size,
      scheduledGuilds: scheduledGuilds.size
    }
  }

  return {
    deliverStartingRoleInfo,
    getRuntimeState,
    registerStartingRoleInfoDispatch,
    scheduleStartingRoleInfo,
    sendStartingRoleInfo
  }
}

function createStartingRoleInfoAction(game, playerId) {
  return {
    actorId: playerId,
    day: game.day || 1,
    firstNightRoleInfo: true,
    guildId: game.guildId,
    phase: game.phase || 'night',
    playerId,
    purpose: 'starting_role_info',
    roleId: getStartingRoleInfoRoleId(game, playerId),
    targetType: 'self'
  }
}

function getStartingRoleInfoRecipients(game) {
  const order = Array.isArray(game.alivePlayers) && game.alivePlayers.length
    ? game.alivePlayers
    : Object.keys(game.users || {})
  const seen = new Set()
  return order
    .filter(userId => {
      if (seen.has(userId)) return false
      seen.add(userId)
      const user = game.users?.[userId]
      return user?.role === 'player' &&
        !!game.roles?.[userId] &&
        shouldSendStartingRoleInfo(game, userId)
    })
}

function getStartingRoleInfoRoleId(game, playerId) {
  return game.shownRoles?.[playerId] || game.roles?.[playerId]
}

function isActiveStartingRoleInfoGame(gameLifecycle, game, guildId = game?.guildId) {
  const currentGame = gameLifecycle?.get?.(guildId)
  return currentGame === game && currentGame?.state === 'in-game' && currentGame.phase === 'night'
}

function createStartingRoleInfoRecorder(gameLifecycle, game, guildId) {
  return {
    save: () => { if (isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) gameLifecycle.save?.() },
    setNightActionPrompt: (...args) => {
      if (isActiveStartingRoleInfoGame(gameLifecycle, game, guildId)) gameLifecycle.setNightActionPrompt?.(...args)
    }
  }
}

module.exports = {
  FALLBACK_ABILITY,
  createMentionedStartingRolePayload,
  createStartingRoleInfoAction,
  createStartingRoleInfoButtonRow,
  createStartingRoleCountInfo,
  createStartingRoleInfoPayload,
  createStartingRoleLabel,
  createStartingRoleInfoSystem,
  createStartingRoleTeamInfo,
  getStartingRoleInfoRoleId,
  getStartingRoleInfoRecipients,
  isActiveStartingRoleInfoGame
}
