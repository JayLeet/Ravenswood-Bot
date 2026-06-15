const {
  queuedChannelSend,
  queuedMessageEdit
} = require('./messageActions')

async function sendOptionalNotice(channel, payload, options = {}) {
  const result = await sendDiscordMessage(channel, payload, {
    failureMessage: options.failureMessage || 'Optional Discord notice was not sent.',
    failureSuggestion: options.failureSuggestion || null,
    unavailableMessage: options.unavailableMessage || 'Target channel is not available.'
  })

  if (result.ok && typeof options.trackMessage === 'function') {
    try {
      options.trackMessage(result.message)
    } catch (err) {
      result.trackError = err
      await logTrackFailure(options, err)
    }
  }

  return result
}

async function sendRequiredMessage(channel, payload, options = {}) {
  return sendDiscordMessage(channel, payload, {
    failureMessage: options.failureMessage || 'Required Discord message was not sent.',
    failureSuggestion: options.failureSuggestion || 'Check my channel permissions, then try again.',
    unavailableMessage: options.unavailableMessage || 'Target channel is not available.'
  })
}

async function editExistingPanel(message, payload, options = {}) {
  if (!message) {
    return createWriteFailure(
      options.unavailableMessage || 'Existing panel message is not available.',
      options.failureSuggestion || null
    )
  }

  const edited = await queuedMessageEdit(message, payload).catch(err => ({ err }))
  if (edited?.err || !edited) {
    return createWriteFailure(
      options.failureMessage || 'Existing panel could not be updated.',
      options.failureSuggestion || 'Refresh the panel, then try again.',
      edited?.err || null
    )
  }

  return { ok: true, message: edited }
}

async function sendDiscordMessage(channel, payload, options = {}) {
  if (!channel?.isTextBased?.()) {
    return createWriteFailure(options.unavailableMessage, options.failureSuggestion || null)
  }

  const sent = await queuedChannelSend(channel, payload).catch(err => ({ err }))
  if (sent?.err || !sent) {
    return createWriteFailure(options.failureMessage, options.failureSuggestion || null, sent?.err || null)
  }

  return { ok: true, message: sent }
}

async function logTrackFailure(options, err) {
  const logger = options.logger
  if (typeof logger?.recoverable !== 'function') return

  await logger.recoverable(
    options.trackFailureAction || 'track-discord-message',
    err,
    options.context || {}
  )
}

function createWriteFailure(message, suggestion = null, cause = null) {
  return {
    ok: false,
    error: {
      cause,
      message,
      suggestion
    },
    message: null
  }
}

module.exports = {
  createWriteFailure,
  editExistingPanel,
  sendOptionalNotice,
  sendRequiredMessage
}
