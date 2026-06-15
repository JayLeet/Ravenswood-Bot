const {
  EmbedBuilder,
} = require('discord.js')
const {
  createSingleFlight
} = require('../../../utils/discord/singleFlight')
const {
  acknowledgeInteraction,
  deleteInteractionReply,
  editInteractionReply,
  followUpInteraction,
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  isSetupUnsafeRoleInteraction,
  parseSetupUnsafeRoleCustomId
} = require('../../../utils/setupUnsafeRoles')
const {
  runSetup
} = require('../../../utils/setupCommand')
const {
  createSetupProgressPayload
} = require('../../../utils/setupProgress')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  logSetupRecoverable
} = require('../../../utils/setupLogging')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../../../utils/commandAccess')

const SETUP_RESULT_COLORS = Object.freeze({
  error: 0xe74c3c,
  success: 0x2ecc71
})

function createSetupUnsafeRoleInteractionSystem({ gameManager, saveServerConfigs, serverConfigs }) {
  const singleFlight = createSingleFlight({ ttlMs: 30000 })

  async function handleSetupUnsafeRoleInteraction(interaction) {
    const parsed = parseSetupUnsafeRoleCustomId(interaction.customId)
    if (!parsed) return null

    if (!hasAdministrator(interaction)) {
      return replyPrivateSystem(
        interaction,
        'Setup cancelled',
        'Only a server administrator or bot owner access user can continue setup after an unsafe role warning.',
        'Ask an administrator or the bot owner access user to review the warning and press the setup button.'
      )
    }

    if (parsed.action === 'cancel') return dismissSetupUnsafeWarning(interaction)

    return runSetupUnsafeFlight(interaction, singleFlight, () => continueUnsafeSetup(interaction, parsed, {
      gameManager,
      saveServerConfigs,
      serverConfigs
    }))
  }

  return {
    getRuntimeState: (...args) => singleFlight.getRuntimeState(...args),
    handleSetupUnsafeRoleInteraction
  }
}

async function continueUnsafeSetup(interaction, parsed, context) {
  const onProgress = createSetupProgressUpdater(interaction)
  await updateInteraction(interaction, createSetupProgressPayload())
  const result = await runSetup(interaction, context, {
    bypassUnsafeRoles: true,
    onProgress,
    privateAccess: parsed.privateAccess
  })
  return sendSetupChoiceResult(interaction, result)
}

async function runSetupUnsafeFlight(interaction, singleFlight, fn) {
  const key = [interaction.guild?.id, interaction.member?.id, interaction.customId].join(':')
  const result = await singleFlight.run(key, fn)
  if (!result.skipped) return result.value
  return acknowledgeInteraction(interaction)
}

function createSetupProgressUpdater(interaction) {
  return completedSteps => updateSetupProgressMessage(interaction, createSetupProgressPayload(completedSteps))
}

async function updateSetupProgressMessage(interaction, payload) {
  if (typeof interaction.editReply === 'function') {
    const edited = await editInteractionReply(interaction, payload).catch(err => logSetupRecoverable('edit-unsafe-role-setup-progress-reply', err, createSetupUnsafeContext(interaction)))
    if (edited) return edited
  }

  if (interaction.message) {
    return queuedMessageEdit(interaction.message, payload).catch(err => logSetupRecoverable('edit-unsafe-role-setup-progress-message', err, createSetupUnsafeContext(interaction)))
  }

  return null
}

async function dismissSetupUnsafeWarning(interaction) {
  const deferred = await acknowledgeInteraction(interaction).then(() => true).catch(err => { logSetupRecoverable('acknowledge-dismiss-unsafe-role-warning', err, createSetupUnsafeContext(interaction)); return false })
  const deleted = await deleteInteractionReply(interaction).then(() => true).catch(err => { logSetupRecoverable('delete-dismissed-unsafe-role-warning', err, createSetupUnsafeContext(interaction)); return false })
  if (deleted) return true

  const edited = await editInteractionReply(interaction, {
    content: 'Dismissed.',
    embeds: [],
    components: []
  }).catch(err => logSetupRecoverable('edit-dismissed-unsafe-role-warning', err, createSetupUnsafeContext(interaction)))
  if (edited) return edited

  if (!deferred) return acknowledgeInteraction(interaction)
  return null
}

async function sendSetupChoiceResult(interaction, result) {
  const payload = createSetupChoiceResultPayload(result)
  const edited = await editInteractionReply(interaction, payload).catch(err => logSetupRecoverable('edit-setup-choice-result', err, createSetupUnsafeContext(interaction)))
  if (edited) return edited

  const followed = await followUpInteraction(interaction, payload).catch(err => logSetupRecoverable('follow-up-setup-choice-result', err, createSetupUnsafeContext(interaction)))
  if (followed) return followed

  if (interaction.channel?.isTextBased?.()) {
    return queuedChannelSend(interaction.channel, payload).catch(err => logSetupRecoverable('send-setup-choice-result-channel-fallback', err, createSetupUnsafeContext(interaction)))
  }

  return null
}

function createSetupUnsafeContext(interaction) {
  return { channelId: interaction.channelId || interaction.channel?.id, guildId: interaction.guild?.id, messageId: interaction.message?.id, userId: interaction.user?.id }
}

function createSetupChoiceResultPayload(result) {
  if (!result.ok) {
    return {
      content: null,
      embeds: [createSetupResultEmbed(
        'Setup failed',
        result.error?.message || 'Unknown error',
        SETUP_RESULT_COLORS.error
      )],
      components: []
    }
  }

  if (result.embeds?.length) {
    return {
      content: null,
      embeds: result.embeds,
      components: result.components || []
    }
  }

  return {
    content: null,
    embeds: [createSetupResultEmbed(
      result.title || 'Setup complete',
      result.message || 'Setup complete.',
      SETUP_RESULT_COLORS.success
    )],
    components: result.components || []
  }
}

function createSetupResultEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(limitEmbedDescription(description))
    .setColor(color)
    .setTimestamp()
}

function limitEmbedDescription(description) {
  const text = String(description || 'No details provided')
  if (text.length <= 4096) return text
  return `${text.slice(0, 4093)}...`
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = {
  createSetupChoiceResultPayload,
  createSetupProgressUpdater,
  createSetupUnsafeRoleInteractionSystem,
  isSetupUnsafeRoleInteraction,
  runSetupUnsafeFlight,
  sendSetupChoiceResult,
  updateSetupProgressMessage
}
