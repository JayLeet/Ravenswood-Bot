const {
  releaseReservedNightArea
} = require('../../discord/interactions/nightArea/reservedChannels')
const {
  cleanupPlayerMadeVoiceChannelRef,
  clearPlayerMadeVoiceState
} = require('../../discord/interactions/voiceChannels/dayPrivateConversationCleanup')
const {
  cleanupChannelMessages
} = require('../../../utils/channelCleanup')
const {
  isStaleMessageError,
  queuedMessageDelete
} = require('../../../utils/discord/messageActions')
const {
  isMissingChannelError
} = require('../../../utils/discord/interactionErrors')
const {
  createBotLogger
} = require('../../../utils/logger')

const TRACKED_MESSAGE_UNAVAILABLE = Symbol('tracked-message-unavailable')

class CleanupService {
  constructor({ logger = undefined } = {}) {
    this.log = createBotLogger({ logger, subsystem: 'CleanupService' })
  }

  async cleanupTrackedMessages(guild, game) {
    if (!guild || !game?.messages?.length) return

    const remainingRefs = []
    for (const ref of game.messages) {
      const cleaned = await this.cleanupTrackedMessageRef(guild, ref)
      if (!cleaned) remainingRefs.push(ref)
    }

    game.messages = remainingRefs
  }

  async cleanupTrackedMessageRef(guild, ref) {
    if (!ref?.channelId || !ref?.messageId) return true

    const channel = await this.fetchTrackedMessageChannel(guild, ref)
    if (channel === TRACKED_MESSAGE_UNAVAILABLE) return false
    if (!channel) return true
    if (!channel?.messages?.fetch) {
      this.log.recoverable('fetch-tracked-message-unavailable', new Error('Channel message API unavailable'), {
        channelId: ref.channelId,
        guildId: guild.id,
        messageId: ref.messageId
      })
      return false
    }

    const message = await channel.messages.fetch(ref.messageId).catch(err => {
      if (isStaleMessageError(err)) return null
      this.log.recoverable('fetch-tracked-message', err, {
        channelId: ref.channelId,
        guildId: guild.id,
        messageId: ref.messageId
      })
      return TRACKED_MESSAGE_UNAVAILABLE
    })
    if (message === TRACKED_MESSAGE_UNAVAILABLE) return false
    if (!message) return true

    const deleted = await queuedMessageDelete(message, 'BOTC cleanup tracked game message').catch(err => {
      this.log.recoverable('delete-tracked-message', err, {
        channelId: ref.channelId,
        guildId: guild.id,
        messageId: ref.messageId
      })
      return TRACKED_MESSAGE_UNAVAILABLE
    })

    return deleted !== TRACKED_MESSAGE_UNAVAILABLE
  }

  async fetchTrackedMessageChannel(guild, ref) {
    if (!guild?.channels?.fetch) {
      this.log.recoverable('fetch-tracked-message-channel-unavailable', new Error('Guild channel API unavailable'), {
        channelId: ref.channelId,
        guildId: guild?.id,
        messageId: ref.messageId
      })
      return TRACKED_MESSAGE_UNAVAILABLE
    }

    return guild.channels
      .fetch(ref.channelId)
      .catch(err => {
        if (isMissingChannelError(err)) return null
        this.log.recoverable('fetch-tracked-message-channel', err, {
          channelId: ref.channelId,
          guildId: guild.id,
          messageId: ref.messageId
        })
        return TRACKED_MESSAGE_UNAVAILABLE
      })
  }

  async cleanupNightChannels(guild, game) {
    if (!guild || !game?.nightChannels) return

    await this.releaseNightAreas(guild, game)
  }

  async cleanupNightVoiceChannels(guild, game) {
    if (!guild || !game?.nightVoiceChannels) return

    await this.releaseNightAreas(guild, game)
  }

  async cleanupNightChannelMessages(guild, game) {
    if (!guild || !game) return { deleted: 0, failed: 0 }

    const channelIds = [...new Set([
      ...Object.values(game.nightChannels || {}),
      ...Object.values(game.nightVoiceChannels || {})
    ].filter(Boolean))]
    const totals = { deleted: 0, failed: 0 }

    for (const channelId of channelIds) {
      const channel = await this.fetchChannel(guild, channelId, 'fetch-night-cleanup-channel')
      if (!channel?.messages?.fetch) continue

      const result = await cleanupChannelMessages(channel)
      totals.deleted += result.deleted
      totals.failed += result.failed
    }

    return totals
  }

  async releaseNightAreas(guild, game) {
    if (!guild || !game) return

    const playerIds = new Set([
      ...Object.keys(game.nightVoiceChannels || {}),
      ...Object.keys(game.nightChannels || {}),
      ...Object.keys(game.nightAreaSlots || {})
    ])

    for (const playerId of playerIds) {
      await releaseReservedNightArea({
        guild,
        game,
        playerId,
        botUserId: guild.client?.user?.id || guild.members?.me?.id
      })
    }
  }

  async cleanupPlayerMadeVoiceChannels(guild, game, options = {}) {
    if (!guild || !game) return

    const includeCreator = options.includeCreator === true
    const remainingVoiceRefs = { ...(game.playerMadeVoiceChannels || {}) }
    const remainingAccessRefs = { ...(game.playerMadeVoiceAccess || {}) }

    for (const [playerId, channelId] of Object.entries(game.playerMadeVoiceChannels || {})) {
      const cleaned = await cleanupPlayerMadeVoiceChannelRef({
        actionPrefix: 'cleanup-service-player-made-voice-channel',
        channelId,
        deleteReason: 'BOTC player-made day voice cleanup',
        guild,
        logger: this.log,
        playerId
      })
      if (!cleaned) continue

      clearPlayerMadeVoiceState({ game, gameLifecycle: this.createPlayerMadeVoiceRegistry(game), guildId: guild.id, playerId })
      delete remainingVoiceRefs[playerId]
      delete remainingAccessRefs[playerId]
    }

    if (includeCreator && game.privateConversationCreatorChannelId) {
      const cleaned = await cleanupPlayerMadeVoiceChannelRef({
        actionPrefix: 'cleanup-service-private-conversation-creator',
        channelId: game.privateConversationCreatorChannelId,
        deleteReason: 'BOTC private conversation creator cleanup',
        guild,
        logger: this.log
      })

      if (cleaned) game.privateConversationCreatorChannelId = null
    }

    game.playerMadeVoiceChannels = remainingVoiceRefs
    game.playerMadeVoiceAccess = Object.fromEntries(
      Object.entries(remainingAccessRefs).filter(([playerId]) => remainingVoiceRefs[playerId])
    )
  }

  createPlayerMadeVoiceRegistry(game) {
    return {
      unregisterPlayerMadeVoiceChannel: (guildId, playerId) => {
        if (game.playerMadeVoiceChannels) delete game.playerMadeVoiceChannels[playerId]
      }
    }
  }

  async cleanupStorytellerDen(guild, game) {
    if (game) game.storytellerDenChannelId = null
  }

  async cleanupTownsquare(guild, game) {
    if (game) game.townsquareChannelId = null
  }

  async cleanupPublicDaySideChannels(guild, game) {
    if (game) game.publicDaySideChannelIds = {}
  }

  async cleanupNightChannelForUser(guild, game, userId) {
    await this.cleanupNightAreaForUser(guild, game, userId)
  }

  async cleanupNightVoiceChannelForUser(guild, game, userId) {
    await this.cleanupNightAreaForUser(guild, game, userId)
  }

  async cleanupNightAreaForUser(guild, game, userId) {
    if (!guild || !game || !userId) return

    await releaseReservedNightArea({
      guild,
      game,
      playerId: userId,
      botUserId: guild.client?.user?.id || guild.members?.me?.id
    })
  }

  async fetchChannel(guild, channelId, action) {
    if (!guild?.channels?.fetch) {
      this.log.recoverable(`${action}-unavailable`, new Error('Guild channel API unavailable'), {
        guildId: guild?.id,
        channelId
      })
      return null
    }

    return guild.channels
      .fetch(channelId)
      .catch(err => {
        this.log.recoverable(action, err, { guildId: guild.id, channelId })
        return null
      })
  }
}

module.exports = CleanupService
