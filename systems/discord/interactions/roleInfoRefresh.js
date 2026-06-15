const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  createNightResponseMenuPayload
} = require('../embeds')
const {
  ensurePlayerNightArea
} = require('./nightArea')
const {
  ROLE_CHANGE_INFO_PROMPT_KEY,
  sendOrEditNightPromptMessage
} = require('./nightPromptMessages')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createNightInfoDismissCustomId
} = require('../../../utils/nightActionCustomIds')

function createRoleInfoRefreshSystem({
  client,
  serverConfigs,
  gameLifecycle,
  isSetupComplete,
  findNightChannelParent,
  getPlayerLabels
}) {
  const activeRefreshes = new Map()
  const log = createBotLogger({ subsystem: 'RoleInfoRefresh' })
  let registered = false

  function registerRoleInfoRefreshDispatch() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('GAME_ENDED', ({ game }) => {
      if (game?.guildId) activeRefreshes.delete(game.guildId)
    })

    gameLifecycle.events.on('PLAYER_ROLE_ASSIGNED', ({ game, playerId, roleId }) => {
      if (!markPendingRoleInfoRefresh(game, playerId, roleId, gameLifecycle)) return
      if (game.phase === 'night') schedulePendingRoleInfoRefresh(client, game.guildId)
    })

    gameLifecycle.events.on('LUNATIC_INFO_CHANGED', ({ game, playerId, info }) => {
      const roleId = info?.demonRoleId || game?.shownRoles?.[playerId] || game?.roles?.[playerId]
      if (!markPendingRoleInfoRefresh(game, playerId, roleId, gameLifecycle)) return
      if (game.phase === 'night') schedulePendingRoleInfoRefresh(client, game.guildId)
    })

    gameLifecycle.events.on('PHASE_CHANGED', ({ game, to }) => {
      if (to !== 'night') {
        if (game?.guildId) activeRefreshes.delete(game.guildId)
        return
      }
      schedulePendingRoleInfoRefresh(client, game.guildId)
    })

    return true
  }

  function schedulePendingRoleInfoRefresh(discordClient, guildId) {
    if (!guildId || activeRefreshes.has(guildId)) return activeRefreshes.get(guildId) || null

    const refresh = sendPendingRoleInfoRefreshes(discordClient, guildId)
      .catch(err => {
        log.recoverable('send-pending-role-info-refreshes', err, { guildId })
        return 0
      })
    const trackedRefresh = refresh.finally(() => {
      if (activeRefreshes.get(guildId) === trackedRefresh) activeRefreshes.delete(guildId)
    })

    activeRefreshes.set(guildId, trackedRefresh)
    return trackedRefresh
  }

  async function sendPendingRoleInfoRefreshes(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return 0

    const game = gameLifecycle.get(guildId)
    const view = gameLifecycle.getGameView(guildId)
    if (!view || !isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) return 0

    const recipients = getPendingRoleInfoRecipients(game)
    if (!recipients.length) return 0

    const guild = discordClient.guilds.cache.get(guildId) ||
      await discordClient.guilds.fetch(guildId).catch(err => {
        log.recoverable('fetch-role-info-refresh-guild', err, { guildId })
        return null
      })
    if (!guild) return 0

    const parent = await findNightChannelParent(discordClient, guild, serverConfig)
    const playerLabels = await getPlayerLabels(discordClient, guildId, view)
    let deliveredCount = 0

    for (const playerId of recipients) {
      if (!isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) break

      const delivered = await sendRoleInfoRefreshToPlayer({
        discordClient,
        game,
        guild,
        guildId,
        parent,
        playerId,
        playerLabels,
        view
      })

      if (delivered || shouldDropPendingRoleInfoRefresh(gameLifecycle, game, playerId)) {
        clearPendingRoleInfoRefresh(game, playerId)
      }
      if (delivered) deliveredCount += 1
    }

    if (isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId) &&
      (deliveredCount || recipients.length !== getPendingRoleInfoRecipients(game).length)) {
      gameLifecycle.save()
    }

    return deliveredCount
  }

  async function sendRoleInfoRefreshToPlayer(options) {
    const { discordClient, game, guild, guildId, parent, playerId, playerLabels, view } = options
    if (!isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) return false
    if (shouldDropPendingRoleInfoRefresh(gameLifecycle, game, playerId)) return false

    const member = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-role-info-member',
      guild,
      logger: log,
      userId: playerId
    })
    if (!member) return false
    if (!isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) return false

    const area = await ensurePlayerNightArea({
      discordClient,
      guild,
      parent,
      game,
      gameLifecycle,
      member,
      view
    })
    if (!area?.textChannel) return false
    if (!isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) return false

    const action = createRoleInfoRefreshAction(game, playerId)
    const payload = createRoleInfoRefreshPayload(action, view, playerLabels)
    const delivered = await sendOrEditNightPromptMessage({
      action,
      channel: area.textChannel,
      client: discordClient,
      game,
      gameLifecycle: createRoleInfoRefreshRecorder(gameLifecycle, game, guildId),
      guildId,
      logger: log,
      payload,
      playerId
    })

    if (!delivered?.message || !isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) return false

    game.roleInfoSent ??= {}
    game.roleInfoSent[playerId] = Date.now()
    return true
  }

  function getRuntimeState() {
    return {
      activeRefreshes: activeRefreshes.size
    }
  }

  return {
    getRuntimeState,
    registerRoleInfoRefreshDispatch,
    sendPendingRoleInfoRefreshes
  }
}

function markPendingRoleInfoRefresh(game, playerId, roleId, gameLifecycle = null) {
  if (!game?.guildId || game.state !== 'in-game' || !playerId) return false
  if (game.users?.[playerId]?.role !== 'player' || !roleId) {
    clearPendingRoleInfoRefresh(game, playerId)
    gameLifecycle?.save?.()
    return false
  }

  game.pendingRoleInfoUpdates ??= {}
  game.pendingRoleInfoUpdates[playerId] = Date.now()
  gameLifecycle?.save?.()
  return true
}

function shouldDropPendingRoleInfoRefresh(gameLifecycle, game, playerId) {
  return game.users?.[playerId]?.role !== 'player' ||
    !game.roles?.[playerId] ||
    gameLifecycle.isFakePlayer?.(game, playerId) === true
}

function isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId = game?.guildId) {
  const currentGame = gameLifecycle?.get?.(guildId)
  return currentGame === game &&
    currentGame?.state === 'in-game' &&
    currentGame.phase === 'night'
}

function createRoleInfoRefreshRecorder(gameLifecycle, game, guildId) {
  return {
    save: () => {
      if (isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) gameLifecycle.save?.()
    },
    setNightActionPrompt: (...args) => {
      if (isActiveRoleInfoRefreshGame(gameLifecycle, game, guildId)) {
        gameLifecycle.setNightActionPrompt?.(...args)
      }
    }
  }
}

function clearPendingRoleInfoRefresh(game, playerId) {
  if (!game?.pendingRoleInfoUpdates) return
  delete game.pendingRoleInfoUpdates[playerId]
}

function getPendingRoleInfoRecipients(game) {
  return Object.keys(game?.pendingRoleInfoUpdates || {})
}

function createRoleInfoRefreshAction(game, playerId) {
  return {
    actorId: playerId,
    day: game.day,
    firstNightRoleInfo: true,
    guildId: game.guildId,
    infoOnly: true,
    phase: game.phase,
    playerId,
    prompt: null,
    purpose: 'role_change_info',
    roleId: game.roles?.[playerId] || null,
    targetType: 'self'
  }
}

function createRoleInfoRefreshPayload(action, view, playerLabels = {}) {
  const payload = createNightResponseMenuPayload({
    action,
    playerLabels,
    text: null,
    view
  })

  return {
    ...payload,
    components: [createRoleInfoRefreshDismissRow(action.playerId)],
    allowedMentions: { users: [action.playerId] }
  }
}

function createRoleInfoRefreshDismissRow(playerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createNightInfoDismissCustomId(playerId, ROLE_CHANGE_INFO_PROMPT_KEY))
      .setLabel('Got it')
      .setStyle(ButtonStyle.Success)
  )
}

module.exports = {
  clearPendingRoleInfoRefresh,
  createRoleInfoRefreshAction,
  createRoleInfoRefreshDismissRow,
  createRoleInfoRefreshPayload,
  createRoleInfoRefreshSystem,
  getPendingRoleInfoRecipients,
  isActiveRoleInfoRefreshGame,
  markPendingRoleInfoRefresh,
  shouldDropPendingRoleInfoRefresh
}
