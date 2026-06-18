const { ChannelType } = require('discord.js')

const MAX_CHAT_MESSAGES = 1000
const SAVE_DEBOUNCE_MS = 1000

function createGameChatCapture({
  gameManager,
  loadPendingGameSummary = null,
  saveGames = null,
  savePendingGameSummary = null,
  serverConfigs
}) {
  const saveTimers = new Map()

  function handleMessageCreate(message) {
    if (!shouldCaptureMessage(message)) return false

    const guildId = message.guildId || message.guild?.id
    const serverConfig = serverConfigs?.get?.(guildId) || {}
    const game = gameManager.get(guildId)
    if (game && game.state !== 'ended' && isActiveGameChannel(message.channelId, game, serverConfig)) {
      appendChatMessage(game, createChatMessage(message, game, serverConfig))
      scheduleGameSave(guildId)
      return true
    }

    const pendingSummary = loadPendingGameSummary?.(guildId)
    if (pendingSummary && isPendingSummaryChannel(message.channelId, serverConfig)) {
      appendChatMessage(pendingSummary, createPostGameChatMessage(message, pendingSummary))
      savePendingGameSummary?.(pendingSummary)
      return true
    }

    return false
  }

  function scheduleGameSave(guildId) {
    if (!saveGames || saveTimers.has(guildId)) return
    saveTimers.set(guildId, setTimeout(() => {
      saveTimers.delete(guildId)
      saveGames(gameManager.games)
    }, SAVE_DEBOUNCE_MS))
  }

  return { handleMessageCreate }
}

function shouldCaptureMessage(message) {
  return Boolean(
    message?.guildId &&
    message.channelId &&
    message.author?.id &&
    !message.author.bot &&
    hasMessageContent(message)
  )
}

function hasMessageContent(message) {
  return Boolean(
    normalizeContent(message.cleanContent || message.content) ||
    message.attachments?.size ||
    message.stickers?.size
  )
}

function isActiveGameChannel(channelId, game, serverConfig) {
  return getActiveGameChannelIds(game, serverConfig).has(channelId)
}

function isPendingSummaryChannel(channelId, serverConfig) {
  return Boolean(channelId && channelId === serverConfig?.postGameChannelId)
}

function getActiveGameChannelIds(game, serverConfig) {
  return new Set([
    serverConfig.gameChannelId,
    serverConfig.liveChannelId,
    serverConfig.postGameChannelId,
    serverConfig.spectatorChannelId,
    serverConfig.storytellerChannelId,
    serverConfig.waitingRoomVoiceChannelId,
    game.storytellerDenChannelId,
    game.townsquareChannelId,
    game.privateConversationCreatorChannelId,
    ...Object.values(game.publicDaySideChannelIds || {}),
    ...Object.values(game.playerMadeVoiceChannels || {}),
    ...Object.values(game.nightChannels || {}),
    ...Object.values(game.nightVoiceChannels || {})
  ].filter(Boolean))
}

function appendChatMessage(target, entry) {
  target.chatMessages ??= []
  target.chatMessagesDropped = Number(target.chatMessagesDropped) || 0
  target.chatMessages.push(entry)
  while (target.chatMessages.length > MAX_CHAT_MESSAGES) {
    target.chatMessages.shift()
    target.chatMessagesDropped += 1
  }
}

function createChatMessage(message, game, serverConfig) {
  return {
    ...createBaseChatMessage(message, game),
    day: game.day || 1,
    phase: game.phase || game.state || null,
    phaseLabel: getPhaseLabel(game, message.channelId, serverConfig)
  }
}

function createPostGameChatMessage(message, summary) {
  return {
    ...createBaseChatMessage(message, summary),
    day: summary.day || 1,
    phase: 'post-game',
    phaseLabel: 'Post-game chat'
  }
}

function createBaseChatMessage(message, gameLike) {
  const user = gameLike.users?.[message.author.id] || {}
  return {
    authorId: message.author.id,
    channelId: message.channelId,
    channelKind: getChannelKind(message.channel),
    channelName: getChannelName(message.channel),
    content: normalizeContent(message.cleanContent || message.content),
    displayName: getMessageDisplayName(message),
    role: user.role || 'server member',
    timestamp: message.createdTimestamp || Date.now(),
    attachments: [...(message.attachments?.values?.() || [])].map(formatAttachment),
    stickers: [...(message.stickers?.values?.() || [])].map(formatSticker)
  }
}

function getPhaseLabel(game, channelId, serverConfig) {
  if (game.state === 'lobby' || game.phase === 'lobby') return 'Pre-game chat'
  if (channelId === serverConfig?.postGameChannelId) return 'Post-game chat'
  if (game.phase === 'night') return `Night ${game.day || '?'}`
  if (game.phase) return `Day ${game.day || '?'}`
  return 'Game chat'
}

function getChannelKind(channel) {
  return channel?.type === ChannelType.GuildVoice ? 'voice' : 'text'
}

function getChannelName(channel) {
  return normalizeContent(channel?.name) || 'unknown-channel'
}

function getMessageDisplayName(message) {
  return normalizeContent(
    message.member?.displayName ||
    message.author?.globalName ||
    message.author?.username
  ) || 'Unknown user'
}

function formatAttachment(attachment) {
  return {
    name: normalizeContent(attachment.name) || 'attachment',
    url: attachment.url || null
  }
}

function formatSticker(sticker) {
  return {
    name: normalizeContent(sticker.name) || 'sticker'
  }
}

function normalizeContent(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

module.exports = {
  MAX_CHAT_MESSAGES,
  createGameChatCapture
}
