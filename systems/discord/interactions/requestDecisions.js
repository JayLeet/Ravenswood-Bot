const {
  queuedChannelSend
} = require('../../../utils/discord/messageActions')
const {
  createGrimoireAccessGrantedMessage
} = require('../../../utils/grimoireAccess')
const {
  parseRequestDecisionCustomId
} = require('../../../utils/requestDecisionButtons')
const {
  createSystemEmbed,
  deleteInteractionReply,
  deferPrivateReply,
  editInteractionReply,
  extractMentions
} = require('./feedback')
const {
  fetchGuildMemberWithRecoverableFallback,
  fetchWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'RequestDecisions' })

function createRequestDecisionInteractionSystem({
  gameLifecycle,
  serverConfigs
}) {
  async function handleRequestDecisionInteraction(interaction) {
    const parsed = parseRequestDecisionCustomId(interaction.customId)
    if (!parsed) return null

    await deferPrivateReply(interaction)

    const pending = gameLifecycle.getPendingRequest(interaction.guild.id, parsed.requestId)
    if (!pending.ok) return editRequestFailure(interaction, pending.error?.message || 'Pending request not found.')

    const requestedMember = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-request-decision-member',
      context: {
        requestId: parsed.requestId
      },
      guild: interaction.guild,
      logger: log,
      userId: pending.request.userId
    })
    if (!requestedMember) return editRequestFailure(interaction, 'Requested user is no longer in this server.')

    const result = parsed.action === 'approve'
      ? await gameLifecycle.approveRequest(interaction.guild.id, interaction.member, parsed.requestId, requestedMember)
      : await gameLifecycle.rejectRequest(interaction.guild.id, interaction.member, parsed.requestId)

    if (!result.ok) return editRequestFailure(interaction, result.error?.message || 'Request update failed.')

    await editInteractionReply(interaction, {
      embeds: [createSystemEmbed('Done', formatRequestResult(parsed.action, result.request), 0x2ecc71)],
      components: []
    })
    scheduleInteractionCleanup(interaction)
    await sendRequestNotice(interaction, result.request, parsed.action)
    return null
  }

  async function sendRequestNotice(interaction, request, action) {
    const config = serverConfigs.get(interaction.guild.id)
    const notice = createNotice(request, action)
    const channelId = notice.public ? config?.liveChannelId : config?.spectatorChannelId
    if (!channelId || !notice.message) return null

    const channel = await fetchWithRecoverableFallback({
      action: 'fetch-request-notice-channel',
      context: {
        channelId,
        guildId: interaction.guild.id,
        requestId: request.id,
        userId: request.userId
      },
      fetch: () => interaction.client.channels.fetch(channelId),
      logger: log
    })
    if (!channel?.isTextBased()) return null

    return queuedChannelSend(channel, {
      content: extractMentions(notice.message),
      embeds: [createSystemEmbed('📨 Request Update', notice.message, 0x3498db)]
    }).catch(err => {
      log.recoverable('send-request-notice', err, {
        channelId,
        guildId: interaction.guild.id,
        requestId: request.id,
        userId: request.userId
      })
      return null
    })
  }

  return {
    handleRequestDecisionInteraction
  }
}

function editRequestFailure(interaction, message) {
  const updated = editInteractionReply(interaction, {
    embeds: [
      createSystemEmbed(
        'Action failed',
        `${message}\n\nTry \`/requests\` again to reload the current pending queue.`
      )
    ],
    components: []
  })
  scheduleInteractionCleanup(interaction)
  return updated
}

function scheduleInteractionCleanup(interaction) {
  setTimeout(() => deleteInteractionReply(interaction).catch(() => null), 3000)
}

function formatRequestResult(action, request) {
  const verb = action === 'approve' ? 'Approved' : 'Rejected'
  return `${verb} ${request.type} request for <@${request.userId}>.`
}

function createNotice(request, action) {
  if (action === 'approve') return createApprovalNotice(request)

  const message = `<@${request.userId}> your ${request.type} request was not approved.`
  return {
    public: request.type === 'join',
    message
  }
}

function createApprovalNotice(request) {
  if (request.type === 'grimoire') {
    return { public: false, message: createGrimoireAccessGrantedMessage(request.userId) }
  }

  if (request.type === 'spectate') {
    return { public: false, message: `<@${request.userId}> your spectate request was approved. You are now spectating.` }
  }

  return { public: true, message: `<@${request.userId}> your join request was approved. You are now a player.` }
}

module.exports = {
  createRequestDecisionInteractionSystem
}
