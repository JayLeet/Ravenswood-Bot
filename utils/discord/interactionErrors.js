function getDiscordErrorCode(err) {
  return err?.code ?? err?.rawError?.code ?? err?.status ?? err?.statusCode
}

function isUnknownMessageError(err) {
  return getDiscordErrorCode(err) === 10008
}

function isUnknownInteractionError(err) {
  return getDiscordErrorCode(err) === 10062
}

function isUnknownWebhookError(err) {
  return getDiscordErrorCode(err) === 10015
}

function isUnknownChannelError(err) {
  return getDiscordErrorCode(err) === 10003
}

function isChannelNotCachedError(err) {
  const code = getDiscordErrorCode(err)
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 'ChannelNotCached' || message.includes('could not find the channel')
}

function isInvalidWebhookTokenError(err) {
  return getDiscordErrorCode(err) === 50027
}

function isAlreadyAcknowledgedInteractionError(err) {
  return getDiscordErrorCode(err) === 40060
}

function isIgnorableInteractionResponseError(err) {
  return isUnknownMessageError(err) ||
    isUnknownInteractionError(err) ||
    isUnknownChannelError(err) ||
    isChannelNotCachedError(err) ||
    isUnknownWebhookError(err) ||
    isInvalidWebhookTokenError(err) ||
    isAlreadyAcknowledgedInteractionError(err)
}

async function safeInteractionResponse(write) {
  try {
    return await write()
  } catch (err) {
    if (isIgnorableInteractionResponseError(err)) return null
    throw err
  }
}

module.exports = {
  getDiscordErrorCode,
  isAlreadyAcknowledgedInteractionError,
  isChannelNotCachedError,
  isIgnorableInteractionResponseError,
  isInvalidWebhookTokenError,
  isUnknownChannelError,
  isUnknownInteractionError,
  isUnknownMessageError,
  isUnknownWebhookError,
  safeInteractionResponse
}
