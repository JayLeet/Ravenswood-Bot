const {
  EmbedBuilder,
  MessageFlags
} = require('discord.js')
const {
  sendOptionalNotice
} = require('./discord/writeIntents')
const {
  extractMentions
} = require('./discord/mentions')
const {
  fetchWithRecoverableFallback
} = require('./discord/recoverableFetch')
const {
  isIgnorableInteractionResponseError,
  isUnknownInteractionError,
  isUnknownMessageError
} = require('./discord/interactionErrors')
const {
  formatFailureMessage,
  getFailureSuggestion
} = require('./failureSuggestions')
const {
  createBotLogger
} = require('./logger')
const {
  cleanupAfterResult,
  refreshAfterResult,
  startEndedCommandSideEffects
} = require('./commandWrapperEndGame')

const COLORS = {
  success: 0x2ecc71,
  error: 0xe74c3c,
  info: 0x3498db,
  end: 0xf1c40f
}
const DEFAULT_SUCCESS_TITLE = 'Command completed'
const DEFAULT_FAILURE_TITLE = 'Command could not run'
const DEFAULT_SUCCESS_MESSAGE = 'The command finished successfully.'
const log = createBotLogger({ subsystem: 'CommandWrapper' })

function wrapCommand(handler, options = {}) {
  return async (interaction, ctx) => {
    const ephemeral = resolveEphemeral(options, interaction, ctx)
    const replyOptions = {
      ...options,
      deferredEphemeral: ephemeral
    }

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply(createEphemeralOptions(ephemeral))
      }

      const result = await handler(interaction, ctx)

      if (!result) {
        return sendFailure(
          interaction,
          replyOptions,
          'No response returned from command',
          'Try `/help` to choose another command. If it keeps happening, ask an admin to check the bot logs.'
        )
      }

      if (!result.ok) {
        const { error } = result
        const suggestion = getFailureSuggestion({ interaction, ctx, error })
        return sendFailure(
          interaction,
          replyOptions,
          error?.message || 'Unknown error',
          suggestion
        )
      }

      if (result.ended) {
        const reply = await sendPrimaryResponse(interaction, replyOptions, {
          embeds: [
            createEmbed(
              'Game ended',
              `Winner: ${result.winner}\nReason: ${result.reason}`,
              'end'
            )
          ],
          components: result.components || []
        })
        trackMessage(interaction, ctx, reply, ephemeral)
        if (startEndedCommandSideEffects({
          ctx,
          interaction,
          log,
          result,
          sendResultMessages
        })) return null
        await sendResultMessages(interaction, result, ctx)
        return refreshAfterResult(interaction, result, ctx, log)
      }

      if (result.embeds) {
        const reply = await sendPrimaryResponse(interaction, replyOptions, {
          embeds: result.embeds,
          components: result.components || []
        })
        trackMessage(interaction, ctx, reply, ephemeral)
        await sendResultMessages(interaction, result, ctx)
        return cleanupAfterResult(result, ctx, log)
      }

      if (result.message) {
        const reply = await sendPrimaryResponse(interaction, replyOptions, {
          embeds: [createEmbed(result.title || DEFAULT_SUCCESS_TITLE, result.message, 'success')],
          components: result.components || []
        })
        trackMessage(interaction, ctx, reply, ephemeral)
        await sendResultMessages(interaction, result, ctx)
        return cleanupAfterResult(result, ctx, log)
      }

      const reply = await sendPrimaryResponse(interaction, replyOptions, {
        embeds: [createEmbed(result.title || DEFAULT_SUCCESS_TITLE, DEFAULT_SUCCESS_MESSAGE, 'success')],
        components: result.components || []
      })
      trackMessage(interaction, ctx, reply, ephemeral)
      await sendResultMessages(interaction, result, ctx)
      return cleanupAfterResult(result, ctx, log)

    } catch (err) {
      log.error('command-handler-crash', err, {
        command: interaction.commandName,
        guildId: interaction.guild?.id,
        userId: interaction.user?.id || interaction.member?.id
      })
      return sendFailure(
        interaction,
        replyOptions,
        'Internal error occurred',
        'Try again once. If it keeps happening, ask an admin to check the bot logs.'
      )
    }
  }
}

function resolveEphemeral(options, interaction, ctx) {
  const value = typeof options.ephemeral === 'function'
    ? options.ephemeral(interaction, ctx)
    : options.ephemeral

  return value !== false
}

function createEphemeralOptions(ephemeral = true) {
  return ephemeral ? { flags: MessageFlags.Ephemeral } : {}
}

function createEmbed(title, description, type) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(limitDescription(description))
    .setColor(COLORS[type] || COLORS.info)
    .setTimestamp()
}

function limitDescription(description) {
  const text = String(description || 'No details provided')
  if (text.length <= 4096) return text
  return `${text.slice(0, 4093)}...`
}

async function sendFailure(interaction, options, message, suggestion = null) {
  const payload = {
    embeds: [createEmbed(DEFAULT_FAILURE_TITLE, formatFailureMessage(message, suggestion), 'error')]
  }

  if (options.deferredEphemeral === false) {
    await interaction.deleteReply().catch(() => {})
    return safeFollowUp(interaction, {
      ...payload,
      flags: MessageFlags.Ephemeral
    })
  }

  return sendPrimaryResponse(interaction, options, payload)
}

async function sendPrimaryResponse(interaction, options, payload) {
  try {
    return await interaction.editReply(payload)
  } catch (err) {
    if (!isIgnorableInteractionResponseError(err)) throw err

    return safeFollowUp(interaction, createFallbackPayload(payload, options))
  }
}

function createFallbackPayload(payload, options = {}) {
  if (options.deferredEphemeral === false) return payload
  return { ...payload, flags: MessageFlags.Ephemeral }
}

async function safeFollowUp(interaction, payload) {
  try {
    return await interaction.followUp(payload)
  } catch (err) {
    if (!isIgnorableInteractionResponseError(err)) throw err
    return null
  }
}

async function sendResultMessages(interaction, result, ctx = {}) {
  await sendRoutedMessage(interaction, ctx, result.storytellerMessage, ctx.serverConfig?.storytellerChannelId, result.storytellerComponents)
  await sendRoutedMessage(interaction, ctx, result.publicMessage, ctx.serverConfig?.liveChannelId, result.publicComponents)
  await sendRoutedMessage(interaction, ctx, result.postGameMessage, ctx.serverConfig?.postGameChannelId, result.postGameComponents, { allowFallback: false })
  await sendRoutedMessage(interaction, ctx, result.spectatorMessage, ctx.serverConfig?.spectatorChannelId, result.spectatorComponents)
}

async function sendRoutedMessage(interaction, ctx, message, channelId, components = [], options = {}) {
  if (!message) return

  const payload = {
    content: extractMentions(message),
    embeds: [createEmbed('📣 Game Notice', message, 'info')],
    components: components || []
  }

  if (channelId) {
    const channel = await fetchWithRecoverableFallback({
      action: 'fetch-routed-command-channel',
      context: {
        channelId,
        command: interaction.commandName,
        guildId: interaction.guild?.id
      },
      fetch: () => interaction.client.channels.fetch(channelId),
      logger: log
    })

    if (channel?.isTextBased()) {
      const sent = await sendOptionalNotice(channel, payload, {
        context: {
          channelId,
          command: interaction.commandName,
          guildId: interaction.guild?.id
        },
        failureMessage: 'Command side notice was not sent.',
        logger: log,
        trackFailureAction: 'track-routed-command-notice-message',
        trackMessage: message => trackMessage(interaction, ctx, message, false)
      })
      if (!sent.ok) return null
      return sent.message
    }
  }

  if (options.allowFallback === false) return null
  const sent = await safeFollowUp(interaction, payload)
  trackMessage(interaction, ctx, sent, false)
  return sent
}

function trackMessage(interaction, ctx, message, ephemeral) {
  if (ephemeral || !message?.id || !ctx?.gameLifecycle || !interaction.guild?.id) return
  ctx.gameLifecycle.trackMessage(interaction.guild.id, message)
}

module.exports = {
  isIgnorableInteractionResponseError,
  isUnknownInteractionError,
  isUnknownMessageError,
  refreshAfterResult,
  safeFollowUp,
  wrapCommand
}
