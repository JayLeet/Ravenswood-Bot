const {
  isStaleMessageError,
  queuedMessageDelete
} = require('../../../../utils/discord/messageActions')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  cleanupChannelMessages
} = require('../../../../utils/channelCleanup')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  releaseReservedNightArea
} = require('./reservedChannels')

const log = createBotLogger({ subsystem: 'NightAreaDayRelease' })

async function releaseAssignedNightAreasForDay({
  client,
  game,
  gameLifecycle,
  guildId,
  cleanupNightTextChannel = cleanupStoredNightTextChannelMessages,
  releaseNightArea = releaseReservedNightArea,
  deletePromptMessage = deleteStoredPromptMessage
}) {
  if (!game || !guildId) return { released: 0, players: [] }

  const playerIds = getAssignedNightAreaPlayerIds(game)
  if (!playerIds.length) return { released: 0, players: [] }

  const guild = await fetchGuild(client, guildId)
  if (!guild) return { released: 0, players: playerIds }

  let released = 0
  for (const playerId of playerIds) {
    const promptsCleaned = await deleteNightPromptMessagesForPlayer(client, game, playerId, deletePromptMessage)
    const textCleaned = await cleanupNightTextChannelsForPlayer(client, game, playerId, cleanupNightTextChannel)
    const releasedNow = await releaseNightArea({
      guild,
      game,
      playerId,
      botUserId: client?.user?.id
    }).catch(err => {
      log.recoverable('release-night-area', err, { guildId, playerId })
      return 0
    })
    released += releasedNow

    if (promptsCleaned && textCleaned && (releasedNow > 0 || !hasAssignedNightArea(game, playerId))) {
      clearNightPromptRefsForPlayer(game, playerId)
    }
  }

  gameLifecycle?.save?.()
  return { released, players: playerIds }
}

function getAssignedNightAreaPlayerIds(game) {
  return [...new Set([
    ...Object.keys(game?.nightAreaSlots || {}),
    ...Object.keys(game?.nightVoiceChannels || {}),
    ...Object.keys(game?.nightChannels || {})
  ])].sort()
}

async function fetchGuild(client, guildId) {
  return client?.guilds?.cache?.get?.(guildId) ||
    await client?.guilds?.fetch?.(guildId).catch(err => {
      log.recoverable('fetch-guild', err, { guildId })
      return null
    }) ||
    null
}

async function deleteNightPromptMessagesForPlayer(client, game, playerId, deletePromptMessage) {
  const refs = getNightPromptRefsForPlayer(game, playerId)
  let ok = true
  for (const ref of refs) {
    const deleted = await deletePromptMessage(client, ref).catch(err => {
      log.recoverable('delete-night-prompt-message', err, {
        channelId: ref.channelId,
        messageId: ref.messageId,
        playerId
      })
      return false
    })
    if (!deleted) ok = false
  }
  return ok
}

async function cleanupNightTextChannelsForPlayer(client, game, playerId, cleanupNightTextChannel) {
  const channelIds = getNightTextChannelIdsForPlayer(game, playerId)
  let ok = true
  for (const channelId of channelIds) {
    const cleaned = await cleanupNightTextChannel(client, channelId).catch(err => {
      log.recoverable('cleanup-night-text-channel', err, { channelId, playerId })
      return false
    })
    if (!cleaned) ok = false
  }
  return ok
}

function hasAssignedNightArea(game, playerId) {
  return Boolean(
    game?.nightAreaSlots?.[playerId] ||
    game?.nightChannels?.[playerId] ||
    game?.nightVoiceChannels?.[playerId]
  )
}

function getNightTextChannelIdsForPlayer(game, playerId) {
  return [...new Set([
    game?.nightChannels?.[playerId],
    game?.nightVoiceChannels?.[playerId],
    ...getNightPromptRefsForPlayer(game, playerId).map(ref => ref.channelId)
  ].filter(Boolean))]
}

function getNightPromptRefsForPlayer(game, playerId) {
  const refs = [
    game?.nightPromptMessages?.[playerId],
    game?.roleInfoPromptMessages?.[playerId],
    ...Object.values(game?.nightInfoPromptMessages?.[playerId] || {})
  ]

  for (const action of game?.nightActions || []) {
    if ((action.actorId || action.playerId) !== playerId) continue
    refs.push({ channelId: action.promptChannelId, messageId: action.promptMessageId })
  }

  return uniquePromptRefs(refs)
}

function uniquePromptRefs(refs) {
  const seen = new Set()
  return refs.filter(ref => {
    if (!ref?.channelId || !ref?.messageId) return false
    const key = `${ref.channelId}:${ref.messageId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function deleteStoredPromptMessage(client, ref) {
  if (!client?.channels?.fetch) {
    log.recoverable('fetch-night-prompt-channel-unavailable', new Error('Discord client channel API unavailable'), {
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return false
  }

  const channel = await client?.channels?.fetch?.(ref.channelId).catch(err => {
    if (isMissingChannelError(err)) return null
    log.recoverable('fetch-night-prompt-channel', err, {
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return false
  })
  if (channel === false) return false
  if (!channel) return true
  if (!channel?.messages?.fetch) {
    log.recoverable('fetch-night-prompt-message-unavailable', new Error('Channel message API unavailable'), {
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return false
  }

  const message = await channel?.messages?.fetch?.(ref.messageId).catch(err => {
    if (isStaleMessageError(err)) return null
    log.recoverable('fetch-night-prompt-message', err, {
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return false
  })
  if (message === false) return false
  if (!message) return true

  const deleted = await queuedMessageDelete(message, 'BOTC clear day-hidden cottage prompt').catch(err => {
    if (isStaleMessageError(err)) return true
    log.recoverable('delete-stored-night-prompt-message', err, {
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return false
  })
  return deleted !== false
}

async function cleanupStoredNightTextChannelMessages(client, channelId) {
  if (!client?.channels?.fetch) {
    log.recoverable('fetch-night-text-channel-unavailable', new Error('Discord client channel API unavailable'), { channelId })
    return false
  }

  const channel = await client?.channels?.fetch?.(channelId).catch(err => {
    if (isMissingChannelError(err)) return null
    log.recoverable('fetch-night-text-channel', err, { channelId })
    return false
  })
  if (channel === false) return false
  if (!channel) return true
  if (!channel?.messages?.fetch) {
    log.recoverable('cleanup-night-text-channel-messages-unavailable', new Error('Channel message API unavailable'), { channelId })
    return false
  }

  const result = await cleanupChannelMessages(channel)
  return result.failed === 0
}

function clearNightPromptRefsForPlayer(game, playerId) {
  if (game?.nightPromptMessages) delete game.nightPromptMessages[playerId]
  if (game?.nightInfoPromptMessages) delete game.nightInfoPromptMessages[playerId]
  if (game?.roleInfoPromptMessages) delete game.roleInfoPromptMessages[playerId]

  for (const action of game?.nightActions || []) {
    if ((action.actorId || action.playerId) !== playerId) continue
    delete action.promptChannelId
    delete action.promptMessageId
  }
}

module.exports = {
  clearNightPromptRefsForPlayer,
  cleanupNightTextChannelsForPlayer,
  cleanupStoredNightTextChannelMessages,
  deleteNightPromptMessagesForPlayer,
  getAssignedNightAreaPlayerIds,
  getNightTextChannelIdsForPlayer,
  getNightPromptRefsForPlayer,
  releaseAssignedNightAreasForDay,
  uniquePromptRefs
}
