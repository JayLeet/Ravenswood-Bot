const {
  EmbedBuilder,
  MessageFlags
} = require('discord.js')
const {
  safeInteractionResponse
} = require('../../../utils/discord/interactionErrors')
const {
  extractMentions
} = require('../../../utils/discord/mentions')
const {
  decorateButtonPayload
} = require('../../../utils/discord/messageActions')
const {
  createSafeInteractionUpdatePayload
} = require('../../../utils/discord/interactionPayloads')
const { formatFailureMessage } = require('../../../utils/failureSuggestions')

const DASHBOARD_SUCCESS_TITLE = 'Action completed'
const LEGACY_DASHBOARD_SUCCESS_TITLE = 'Done'

function createSystemEmbed(title, description, color = 0xe74c3c) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
}

function createPrivateOptions(payload = {}) {
  return {
    ...decorateInteractionPayload(payload),
    flags: MessageFlags.Ephemeral
  }
}

function editDashboardLifecycleFailure(interaction, result) {
  return editDashboardFailure(interaction, {
    title: 'Action failed',
    message: result.error?.message || 'Unknown error',
    suggestion: 'Refresh the dashboard, then try the next valid control.'
  })
}

function editDashboardFailure(interaction, failure) {
  return sendDashboardFeedback(
    interaction,
    failure.title || 'Action failed',
    formatFailureMessage(failure.message || 'Unknown error', failure.suggestion),
    0xe74c3c
  )
}

function editDashboardSuccess(interaction, message) {
  return sendDashboardFeedback(interaction, DASHBOARD_SUCCESS_TITLE, message, 0x2ecc71)
}

async function sendDashboardFeedback(interaction, title, description, color) {
  if (isDashboardSuccessTitle(title) && interaction.botcHasVisibleAdminDiagnostic?.()) {
    await acknowledgeInteraction(interaction)
    return true
  }

  if (typeof interaction.botcUpdateDashboardStatus === 'function') {
    await interaction.botcUpdateDashboardStatus(title, description, color)
    await acknowledgeInteraction(interaction)
    return true
  }

  await acknowledgeInteraction(interaction)
  return true
}

async function acknowledgeInteraction(interaction) {
  if (interaction.deferred || interaction.replied) return null
  if (typeof interaction.deferUpdate === 'function') {
    return interaction.deferUpdate().catch(() => null)
  }
  return deferPrivateReply(interaction)
}

async function deferPrivateReply(interaction) {
  if (interaction.deferred || interaction.replied) return null
  if (typeof interaction.deferReply !== 'function') return null
  const response = await safeInteractionResponse(() => interaction.deferReply(createPrivateOptions()))
  if (response || interaction.deferred || interaction.replied) interaction.botcPrivateReply = true
  return response
}

async function deleteInteractionReply(interaction) {
  if (typeof interaction.deleteReply !== 'function') return null
  return safeInteractionResponse(() => interaction.deleteReply())
}

async function deleteInteractionFollowUp(interaction, message) {
  if (typeof interaction?.webhook?.deleteMessage === 'function' && message?.id) {
    const deleted = await safeInteractionResponse(async () => {
      await interaction.webhook.deleteMessage(message.id)
      return true
    })
    if (deleted) return deleted
  }
  if (typeof message?.delete === 'function') {
    return safeInteractionResponse(async () => {
      await message.delete()
      return true
    })
  }
  return null
}

function editInteractionReply(interaction, payload) {
  return safeInteractionResponse(() => interaction.editReply(decorateInteractionPayload(payload)))
}

async function editInteractionFollowUp(interaction, message, payload) {
  const safePayload = decorateInteractionPayload(payload)
  if (typeof interaction?.webhook?.editMessage === 'function' && message?.id) {
    const edited = await safeInteractionResponse(() => interaction.webhook.editMessage(message.id, safePayload))
    if (edited) return edited
  }
  if (typeof message?.edit === 'function') return safeInteractionResponse(() => message.edit(safePayload))
  return null
}

async function followUpInteraction(interaction, payload) {
  if (typeof interaction.followUp !== 'function') return null
  return safeInteractionResponse(() => interaction.followUp(decorateInteractionPayload(payload)))
}

function replyPrivatePayload(interaction, payload) {
  if (interaction.deferred || interaction.replied) return respondPrivatePayload(interaction, payload)
  return safeInteractionResponse(() => interaction.reply(createPrivateOptions(payload)))
    .then(response => {
      if (response || interaction.replied) interaction.botcPrivateReply = true
      return response
    })
}

async function respondPrivatePayload(interaction, payload) {
  if (!interaction.deferred && !interaction.replied && typeof interaction.reply === 'function') {
    return replyPrivatePayload(interaction, payload)
  }
  if (typeof interaction.followUp === 'function') {
    return safeInteractionResponse(() => interaction.followUp(createPrivateOptions(payload)))
  }
  if (typeof interaction.editReply === 'function') return editInteractionReply(interaction, payload)
  return null
}

function replyPrivateSystem(interaction, title, description, suggestion = null) {
  return replyPrivatePayload(interaction, createSystemPayload(title, description, suggestion))
}

async function respondPrivateSystem(interaction, title, description, suggestion = null) {
  return respondPrivatePayload(interaction, createSystemPayload(title, description, suggestion))
}

function createSystemPayload(title, description, suggestion = null) {
  return {
    embeds: [createSystemEmbed(title, formatFailureMessage(description, suggestion))]
  }
}

function respondAutocomplete(interaction, choices = []) {
  return safeInteractionResponse(() => interaction.respond(choices))
}

function showInteractionModal(interaction, modal) {
  return safeInteractionResponse(() => interaction.showModal(modal))
}

function updateInteraction(interaction, payload) {
  const safePayload = createSafeInteractionUpdatePayload(decorateInteractionPayload(payload))
  if ((interaction.deferred || interaction.replied) && typeof interaction.editReply === 'function') {
    return editInteractionReply(interaction, safePayload)
  }
  return safeInteractionResponse(() => interaction.update(safePayload))
}

function decorateInteractionPayload(payload) {
  return decorateButtonPayload(payload, { preserveBuilders: true })
}

function isDashboardSuccessTitle(title) {
  return title === DASHBOARD_SUCCESS_TITLE || title === LEGACY_DASHBOARD_SUCCESS_TITLE
}

module.exports = {
  acknowledgeInteraction,
  createSystemEmbed,
  DASHBOARD_SUCCESS_TITLE,
  deleteInteractionFollowUp,
  deleteInteractionReply,
  deferPrivateReply,
  editInteractionFollowUp,
  editDashboardFailure,
  editDashboardLifecycleFailure,
  editDashboardSuccess,
  editInteractionReply,
  extractMentions,
  followUpInteraction,
  replyPrivatePayload,
  replyPrivateSystem,
  respondAutocomplete,
  respondPrivatePayload,
  respondPrivateSystem,
  sendDashboardFeedback,
  showInteractionModal,
  updateInteraction
}
