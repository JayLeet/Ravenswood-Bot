const {
  isStaleMessageError
} = require('../../../../utils/discord/messageActions')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  createBotLogger
} = require('../../../../utils/logger')

const TRACKED_REQUEST_UNAVAILABLE = Symbol('tracked-request-unavailable')
const SUBSYSTEM = 'StorytellerRequests'
const log = createBotLogger({ subsystem: SUBSYSTEM })

async function fetchTrackedStorytellerRequestMessage(defaultChannel, ref, context = {}) {
  if (!ref?.messageId) return null
  const channel = ref.channelId === defaultChannel?.id
    ? defaultChannel
    : await fetchTrackedRequestChannel(defaultChannel, ref, context)

  if (channel === TRACKED_REQUEST_UNAVAILABLE) return TRACKED_REQUEST_UNAVAILABLE
  if (!channel) return TRACKED_REQUEST_UNAVAILABLE
  if (!channel.messages?.fetch) {
    log.recoverable(
      'fetch-tracked-request-message-unavailable',
      new Error('Channel message API unavailable'),
      createTrackedRequestContext(ref, context, channel)
    )
    return TRACKED_REQUEST_UNAVAILABLE
  }

  try {
    const message = await channel.messages.fetch({ message: ref.messageId, cache: false, force: true })
    return message || null
  } catch (err) {
    if (isStaleMessageError(err)) return null
    await recoverStorytellerRequestAction('fetch-tracked-request-message', () => {
      throw err
    }, createTrackedRequestContext(ref, context, channel))
    return TRACKED_REQUEST_UNAVAILABLE
  }
}

async function fetchTrackedRequestChannel(defaultChannel, ref, context = {}) {
  if (!defaultChannel?.client?.channels?.fetch) {
    log.recoverable(
      'fetch-tracked-request-channel-unavailable',
      new Error('Discord channel fetch API unavailable'),
      createTrackedRequestContext(ref, context)
    )
    return TRACKED_REQUEST_UNAVAILABLE
  }

  try {
    const channel = await defaultChannel.client.channels.fetch(ref.channelId)
    return channel || null
  } catch (err) {
    if (isMissingChannelError(err)) return null
    await recoverStorytellerRequestAction('fetch-tracked-request-channel', () => {
      throw err
    }, createTrackedRequestContext(ref, context))
    return TRACKED_REQUEST_UNAVAILABLE
  }
}

function recoverStorytellerRequestAction(action, fn, context = {}) {
  const { subsystem = SUBSYSTEM, ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: { recoveryType: 'storyteller-request', ...rest },
    subsystem
  })
}

function createTrackedRequestContext(ref, context = {}, channel = null) {
  return {
    channelId: ref?.channelId || channel?.id,
    guildId: context.guildId || channel?.guildId || channel?.guild?.id,
    messageId: ref?.messageId,
    playerId: context.playerId,
    recoveryType: 'storyteller-request'
  }
}

module.exports = {
  TRACKED_REQUEST_UNAVAILABLE,
  fetchTrackedStorytellerRequestMessage,
  recoverStorytellerRequestAction
}
