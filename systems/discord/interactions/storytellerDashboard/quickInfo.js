const {
  createQuickInfoResponsePayload
} = require('../../embeds')
const {
  queuedChannelSend
} = require('../../../../utils/discord/messageActions')
const {
  sendOrEditNightPromptMessage
} = require('../nightPromptMessages')
const {
  createFakeMember
} = require('../fakeMembers')
const {
  formatDashboardPlayer,
  isFakeDashboardPlayer
} = require('./fakePlayers')
const {
  fetchDashboardMember
} = require('./memberFetch')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'QuickInfo' })

async function sendQuickInfoResponse({
  interaction,
  context,
  gameLifecycle,
  services,
  playerId,
  text,
  payload = null,
  action = null,
  recordSecretInfo = true
}) {
  const targetMember = await getQuickInfoTargetMember(interaction, context, playerId)
  if (!targetMember) return createFailure('I could not find that player in this server.')

  const channel = await services.ensurePlayerNightChannel(interaction, context, targetMember)
  if (!channel) return createFailure('I could not create or find that player private night channel.')

  const deliveryPayload = createMentionedNightInfoPayload(
    payload || createQuickInfoResponsePayload(text),
    context,
    playerId
  )
  const delivered = action
    ? await sendOrEditNightPromptMessage({
      action,
      channel,
      client: interaction.client,
      game: context.game,
      gameLifecycle,
      guildId: interaction.guild.id,
      logger: log,
      payload: deliveryPayload,
      playerId
    })
    : await queuedChannelSend(channel, deliveryPayload)
      .then(message => ({ message, sent: true }))
      .catch(err => {
        log.recoverable('send-quick-info-message', err, {
          channelId: channel.id,
          guildId: interaction.guild?.id,
          playerId
        })
        return null
      })
  const sent = delivered?.message || null

  if (!sent) return createFailure(`I could not post in <#${channel.id}>.`)

  const result = recordSecretInfo
    ? await gameLifecycle.recordSecretInfo(interaction.guild.id, interaction.member, playerId)
    : gameLifecycle.createSuccess()

  if (!result.ok) return { result }

  return {
    result,
    edited: delivered.edited === true,
    sent,
    message: `Sent "${text}" to ${formatDashboardPlayer(context, playerId)} in <#${channel.id}>.`
  }
}

function createMentionedNightInfoPayload(payload, context, playerId) {
  if (isFakeDashboardPlayer(context, playerId)) return payload

  const mention = `<@${playerId}>`
  const content = String(payload?.content || '')
  if (content.includes(mention)) return payload

  return {
    ...payload,
    content: content ? `${mention}\n${content}` : mention
  }
}

async function getQuickInfoTargetMember(interaction, context, playerId) {
  if (isFakeDashboardPlayer(context, playerId)) return createFakeMember(playerId, context.view)
  return fetchDashboardMember(interaction, playerId, 'fetch-quick-info-member')
}

function createFailure(message) {
  return {
    result: {
      ok: false,
      error: { message }
    }
  }
}

module.exports = {
  createMentionedNightInfoPayload,
  getQuickInfoTargetMember,
  sendQuickInfoResponse
}
