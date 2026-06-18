const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')
const {
  cleanupSetupChannels
} = require('../../../utils/channelCleanup')
const {
  createIdleLobbyWarningMessages
} = require('./idleLobbyMessages')
const {
  acknowledgeInteraction,
  updateInteraction
} = require('./feedback')
const {
  CREATE_GAME_COOLDOWN_MS,
  FINAL_WARNING_MS,
  FIRST_WARNING_MS,
  IDLE_LOBBY_ACTIONS,
  IDLE_WARNING_MEMORY_MS,
  MAX_WARNINGS,
  RESPONSE_WINDOW_MS,
  createAcknowledgedEmbed,
  createDismissRow,
  createFinalWarningPayload,
  createIdleWarningDescription,
  createIdleWarningPayload,
  isIdleLobbyInteraction
} = require('./idleLobbyPayloads')

function createIdleLobbyWatchSystem({ client, gameLifecycle, postOrUpdateStorytellerDashboard, serverConfigs, timers = globalThis }) {
  const watches = new Map()
  const warningMemory = new Map()
  const subsystem = 'IdleLobbyWatch'
  const warningMessages = createIdleLobbyWarningMessages({ client, serverConfigs, subsystem })
  let registered = false

  function registerIdleLobbyWatch() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('GAME_CREATED', ({ game }) => scheduleFirstWarning(game))
    gameLifecycle.events.on('GAME_STARTED', ({ game }) => clearStartedGameIdleWarnings(game))
    gameLifecycle.events.on('GAME_ENDED', ({ game }) => clearEndedGameIdleWarnings(game))
    for (const game of gameLifecycle.gameManager?.games?.values?.() || []) scheduleFirstWarning(game)
    return true
  }

  function handleIdleLobbyInteraction(interaction) {
    if (interaction.customId === IDLE_LOBBY_ACTIONS.dismiss) {
      return warningMessages.deleteMessage(
        interaction.message,
        interaction.guild?.id,
        'delete-dismissed-idle-warning',
        'Idle warning dismissed'
      )
        .catch(() => acknowledgeInteraction(interaction))
    }

    const watch = watches.get(interaction.guild?.id)
    if (!watch) return acknowledgeInteraction(interaction)
    if (interaction.member?.id !== watch.storytellerId) return acknowledgeInteraction(interaction)

    const guildId = watch.guildId
    clearWarningMemory(guildId, watch.storytellerId)
    clearWatch(guildId)
    const game = gameLifecycle.get(guildId)
    if (isIdleLobby(game)) scheduleFirstWarning(game)
    return updateInteraction(interaction, { embeds: [createAcknowledgedEmbed()], components: [createDismissRow()] })
  }

  function scheduleFirstWarning(game) {
    if (!isIdleLobby(game)) return
    clearWatch(game.guildId)
    pruneWarningMemory()
    const carriedWarnings = getCarriedWarningCount(game.guildId, game.storytellerId)

    watches.set(game.guildId, {
      guildId: game.guildId,
      storytellerId: game.storytellerId,
      warnings: carriedWarnings,
      timer: timers.setTimeout(() => sendWarning(game.guildId), FIRST_WARNING_MS)
    })
  }

  async function sendWarning(guildId) {
    const watch = watches.get(guildId)
    const game = gameLifecycle.get(guildId)
    if (!watch || !isIdleLobby(game)) return clearWatch(guildId)

    watch.warnings += 1
    rememberWarnings(watch)
    if (watch.warnings >= MAX_WARNINGS) return sendFinalWarning(guildId)

    const message = await warningMessages.sendOrEdit(guildId, watch, createIdleWarningPayload(watch.storytellerId, watch.warnings))
    if (!isActiveIdleWatch(guildId, watch)) return deleteLateIdleWarning(message, guildId)
    if (message) watch.message = message
    watch.timer = timers.setTimeout(() => sendWarning(guildId), RESPONSE_WINDOW_MS)
  }

  async function sendFinalWarning(guildId) {
    const watch = watches.get(guildId)
    const game = gameLifecycle.get(guildId)
    if (!watch || !isIdleLobby(game)) return clearWatch(guildId)

    rememberWarnings(watch)
    const message = await warningMessages.sendOrEdit(guildId, watch, createFinalWarningPayload(watch.storytellerId))
    if (!isActiveIdleWatch(guildId, watch)) return deleteLateIdleWarning(message, guildId)
    if (message) watch.message = message
    gameLifecycle.setCreateGameCooldown?.(guildId, watch.storytellerId, CREATE_GAME_COOLDOWN_MS)
    watch.timer = timers.setTimeout(() => destroyIdleGame(guildId), FINAL_WARNING_MS)
  }

  async function destroyIdleGame(guildId) {
    const watch = watches.get(guildId)
    const game = gameLifecycle.get(guildId)
    if (!watch || !isIdleLobby(game)) return clearWatch(guildId)

    const guild = await recover('fetch-guild-for-idle-destroy', () => client.guilds?.fetch?.(guildId), {
      guildId,
      subsystem
    })
    const result = await recover('force-end-idle-lobby', () => gameLifecycle.forceEnd(game, {
      winner: 'none',
      reason: 'Lobby timed out 1 minute after the final idle warning.'
    }, guild), { guildId, subsystem })
    if (result?.ok && result.ended) {
      await recover('cleanup-idle-lobby-setup-channels', () => cleanupSetupChannels(client, serverConfigs.get(guildId)), {
        guildId,
        subsystem
      })
    } else {
      await recover('refresh-dashboard-after-idle-destroy', () => postOrUpdateStorytellerDashboard(client, guildId), {
        guildId,
        subsystem
      })
    }
    clearWatch(guildId)
  }

  async function clearStartedGameIdleWarnings(game) {
    if (!game?.guildId || !game?.storytellerId) return
    const watch = watches.get(game.guildId)
    clearWarningMemory(game.guildId, game.storytellerId)
    clearWatch(game.guildId)
    if (watch?.message) {
      await warningMessages.deleteMessage(
        watch.message,
        game.guildId,
        'delete-started-game-idle-warning',
        'Idle warning cleared after game start'
      )
    }
  }

  async function clearEndedGameIdleWarnings(game) {
    if (!game?.guildId) return
    const watch = watches.get(game.guildId)
    if (game.storytellerId) clearWarningMemory(game.guildId, game.storytellerId)
    clearWatch(game.guildId)
    if (!watch?.message) return

    await warningMessages.deleteMessage(
      watch.message,
      game.guildId,
      'delete-ended-game-idle-warning',
      'Idle warning cleared after game end'
    )
  }

  function rememberWarnings(watch) {
    warningMemory.set(createWarningMemoryKey(watch.guildId, watch.storytellerId), {
      warnings: Math.min(watch.warnings, MAX_WARNINGS),
      expiresAt: Date.now() + IDLE_WARNING_MEMORY_MS
    })
  }

  function getCarriedWarningCount(guildId, storytellerId) {
    const key = createWarningMemoryKey(guildId, storytellerId)
    const memory = warningMemory.get(key)
    if (!memory) return 0
    if (memory.expiresAt <= Date.now()) {
      warningMemory.delete(key)
      return 0
    }
    return Math.min(memory.warnings, MAX_WARNINGS - 1)
  }

  function clearWarningMemory(guildId, storytellerId) {
    warningMemory.delete(createWarningMemoryKey(guildId, storytellerId))
  }

  function pruneWarningMemory() {
    const now = Date.now()
    let removed = 0
    for (const [key, memory] of warningMemory.entries()) {
      if (memory.expiresAt > now) continue
      warningMemory.delete(key)
      removed += 1
    }
    return removed
  }

  function clearWatch(guildId) {
    const watch = watches.get(guildId)
    if (watch?.timer) timers.clearTimeout(watch.timer)
    watches.delete(guildId)
  }

  function isActiveIdleWatch(guildId, watch) {
    return watches.get(guildId) === watch && isIdleLobby(gameLifecycle.get(guildId))
  }

  function deleteLateIdleWarning(message, guildId) {
    return warningMessages.deleteMessage(
      message,
      guildId,
      'delete-late-idle-warning',
      'Discard idle warning after lobby ended'
    )
  }

  return {
    handleIdleLobbyInteraction,
    registerIdleLobbyWatch,
    prune: pruneWarningMemory,
    size: () => watches.size,
    warningMemorySize: () => warningMemory.size
  }
}

function recover(action, fn, context = {}) {
  const { subsystem = 'IdleLobbyWatch', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem
  })
}

function createWarningMemoryKey(guildId, storytellerId) {
  return `${guildId}:${storytellerId}`
}

function isIdleLobby(game) {
  return Boolean(game && game.state === 'lobby' && !game.startedAt)
}

module.exports = {
  CREATE_GAME_COOLDOWN_MS,
  FINAL_WARNING_MS,
  FIRST_WARNING_MS,
  IDLE_LOBBY_ACTIONS,
  IDLE_WARNING_MEMORY_MS,
  MAX_WARNINGS,
  RESPONSE_WINDOW_MS,
  createAcknowledgedEmbed,
  createDismissRow,
  createIdleLobbyWatchSystem,
  createFinalWarningPayload,
  createIdleWarningDescription,
  createIdleWarningPayload,
  isIdleLobby,
  isIdleLobbyInteraction
}
