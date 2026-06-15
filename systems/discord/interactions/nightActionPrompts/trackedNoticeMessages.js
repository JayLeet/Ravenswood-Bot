const {
  isStaleMessageError,
  queuedMessageDelete
} = require('../../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')

async function fetchTrackedNoticeMessage({
  client = null,
  context = {},
  defaultChannel = null,
  ref,
  subsystem = 'NightInfoStorytellerNotice'
}) {
  if (!ref?.messageId) return { message: null, stale: false, unavailable: false }

  const channel = ref.channelId === defaultChannel?.id
    ? defaultChannel
    : await fetchNoticeChannel(client || defaultChannel?.client, ref, context, subsystem)

  if (channel?.unavailable) return { message: null, stale: false, unavailable: true }
  if (channel?.stale) return { message: null, stale: true, unavailable: false }
  if (!channel?.messages?.fetch) return { message: null, stale: false, unavailable: true }

  try {
    const message = await channel.messages.fetch({ message: ref.messageId, cache: false, force: true })
    return message
      ? { message, stale: false, unavailable: false }
      : { message: null, stale: true, unavailable: false }
  } catch (err) {
    if (isStaleMessageError(err)) return { message: null, stale: true, unavailable: false }
    await logRecoverable('fetch-tracked-night-info-message', err, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    }, subsystem)
    return { message: null, stale: false, unavailable: true }
  }
}

async function deleteTrackedNoticeMessage({
  context = {},
  message,
  reason = 'Night info acknowledged',
  subsystem = 'NightInfoStorytellerNotice'
}) {
  if (!message) return { ok: false, stale: false, unavailable: false }

  try {
    const deleted = await queuedMessageDelete(message, reason)
    return { ok: Boolean(deleted), stale: !deleted, unavailable: false }
  } catch (err) {
    await logRecoverable('delete-tracked-night-info-notice', err, {
      ...context,
      channelId: message.channelId,
      messageId: message.id
    }, subsystem)
    return { ok: false, stale: false, unavailable: true }
  }
}

async function fetchNoticeChannel(client, ref, context, subsystem) {
  if (!client?.channels?.fetch || !ref.channelId) return { stale: false, unavailable: true }

  try {
    const channel = await client.channels.fetch(ref.channelId)
    return channel || { stale: true, unavailable: false }
  } catch (err) {
    if (isMissingChannelError(err)) return { stale: true, unavailable: false }
    await logRecoverable('fetch-tracked-night-info-channel', err, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    }, subsystem)
    return { stale: false, unavailable: true }
  }
}

function isMissingChannelError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10003 || message.includes('unknown channel')
}

function logRecoverable(action, err, context, subsystem) {
  return runRecoverableDiscordAction(action, () => {
    throw err
  }, {
    context,
    subsystem
  })
}

module.exports = {
  deleteTrackedNoticeMessage,
  fetchTrackedNoticeMessage
}
