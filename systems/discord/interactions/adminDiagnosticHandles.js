const { MessageFlags } = require('discord.js')
const {
  deleteInteractionFollowUp,
  deleteInteractionReply,
  editInteractionFollowUp,
  editInteractionReply,
  respondPrivatePayload
} = require('./feedback')
const { queuedMessageDelete, queuedMessageEdit } = require('../../../utils/discord/messageActions')

const RUNNING_PROGRESS_FRAMES = [
  '⚪🔘🔘🔘🔘',
  '🔘⚪🔘🔘🔘',
  '🔘🔘⚪🔘🔘',
  '🔘🔘🔘⚪🔘',
  '🔘🔘🔘🔘⚪'
]

async function sendDiagnostic(interaction, payload) {
  const replyHandle = createInteractionReplyDiagnosticHandle(interaction)
  if (replyHandle) {
    const applied = await replyHandle.apply(payload)
    if (applied) return applied
  }

  const privateResponse = await respondPrivatePayload(interaction, payload)
  const privateHandle = createFollowUpDiagnosticHandle(interaction, privateResponse)
  if (privateHandle) return privateHandle
  return null
}

function createInteractionReplyDiagnosticHandle(interaction) {
  if (typeof interaction?.editReply !== 'function') return null
  if (!hasInteractionResponse(interaction)) return null
  if (!isPrivateReplyInteraction(interaction)) return null

  const handle = {
    type: 'interaction-reply',
    apply: async payload => {
      const edited = await editInteractionReply(interaction, payload)
      if (!edited) return null
      return handle
    },
    delete: async () => deleteInteractionReply(interaction)
  }
  return handle
}

function createFollowUpDiagnosticHandle(interaction, response) {
  const message = getResponseMessage(response)
  if (!message?.id && typeof message?.edit !== 'function') return null
  return {
    type: 'interaction-follow-up',
    interaction,
    message
  }
}

function getResponseMessage(response) {
  return response?.resource?.message || response?.message || response || null
}

async function editDiagnostic(handle, payload) {
  if (handle?.type === 'interaction-reply') return handle.apply(payload)
  if (handle?.type === 'message') {
    const edited = await queuedMessageEdit(handle.message, payload)
    if (!edited) return null
    handle.message = edited
    return handle
  }
  if (handle?.type === 'interaction-follow-up') {
    const edited = await editInteractionFollowUp(handle.interaction, handle.message, payload)
    if (!edited) return null
    handle.message = edited
    return handle
  }
  return null
}

function deleteDiagnostic(handle, reason) {
  if (handle?.type === 'interaction-reply') return handle.delete(reason)
  if (handle?.type === 'interaction-follow-up') return deleteInteractionFollowUp(handle.interaction, handle.message)
  if (handle?.type === 'message') return queuedMessageDelete(handle.message, reason)
  return null
}

function formatProgress(step) {
  return RUNNING_PROGRESS_FRAMES[Math.max(0, step) % RUNNING_PROGRESS_FRAMES.length]
}

function hasInteractionResponse(interaction) {
  return interaction.deferred === true || interaction.replied === true
}

function isPrivateReplyInteraction(interaction) {
  if (interaction.botcPrivateReply === true) return true
  if (interaction.ephemeral === true) return true
  const flags = interaction.message?.flags
  if (!flags) return false
  if (typeof flags.has === 'function') return flags.has(MessageFlags.Ephemeral)
  const bitfield = Number(flags.bitfield ?? flags)
  return Number.isFinite(bitfield) && (bitfield & MessageFlags.Ephemeral) !== 0
}

module.exports = {
  deleteDiagnostic,
  editDiagnostic,
  formatProgress,
  sendDiagnostic
}
