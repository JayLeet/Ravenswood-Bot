const {
  sendOptionalNotice
} = require('../../../utils/discord/writeIntents')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')
const {
  createSystemEmbed,
  extractMentions
} = require('./feedback')

async function sendGamePanelNotices(interaction, serverConfig, result, options = {}) {
  const deliveries = [
    [serverConfig.storytellerChannelId, result.storytellerMessage, null, null],
    [serverConfig.liveChannelId, result.liveMessage, result.publicEmbeds, result.publicComponents],
    [serverConfig.spectatorChannelId, result.spectatorMessage, null, null]
  ]

  for (const [channelId, message, embeds, components] of deliveries) {
    if (!channelId || (!message && !embeds?.length && !components?.length)) continue
    await sendNotice(interaction, channelId, message, embeds, components, options)
  }
}

async function sendNotice(interaction, channelId, message, embeds = null, components = null, options = {}) {
  const subsystem = options.subsystem || 'GamePanel'
  const channel = await recoverDiscord('fetch-game-panel-notice-channel', () => interaction.client.channels.fetch(channelId), {
    channelId,
    guildId: interaction.guild.id,
    subsystem
  })
  if (!channel?.isTextBased()) return null

  const payload = embeds?.length
    ? { embeds: embeds.map(createEmbedFromData) }
    : { content: extractMentions(message), embeds: message ? [createSystemEmbed('Notice', message, 0x3498db)] : [] }
  if (components?.length) payload.components = components
  const sent = await sendOptionalNotice(channel, payload, {
    context: { channelId, guildId: interaction.guild.id, subsystem },
    failureMessage: 'Game panel side notice was not sent.',
    logger: { recoverable: (action, err, context) => recoverDiscord(action, () => { throw err }, { ...context, subsystem }) },
    trackFailureAction: 'track-game-panel-notice-message',
    trackMessage: sentMessage => options.gameLifecycle?.trackMessage?.(interaction.guild.id, sentMessage)
  })
  await logWriteFailure('send-game-panel-notice', sent, { channelId, guildId: interaction.guild.id, subsystem })
  return sent.message
}

function createEmbedFromData(data) {
  return createSystemEmbed(data.title, data.description, data.color || 0x3498db)
}

function logWriteFailure(action, result, context) {
  if (result?.ok || !result?.error) return null
  return recoverDiscord(action, () => {
    throw result.error.cause || new Error(result.error.message)
  }, { ...context, failureMessage: result.error.message })
}

function recoverDiscord(action, fn, context = {}) {
  const { subsystem = 'GamePanel', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem
  })
}

module.exports = {
  sendGamePanelNotices
}
