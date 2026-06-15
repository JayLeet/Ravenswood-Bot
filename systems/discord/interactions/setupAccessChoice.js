const {
  createSingleFlight
} = require('../../../utils/discord/singleFlight')
const {
  acknowledgeInteraction,
  editInteractionReply,
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  sendSetupChoiceResult
} = require('./setupUnsafeRoles')
const {
  isSetupAccessChoiceInteraction,
  parseSetupAccessChoiceCustomId
} = require('../../../utils/setupAccessChoice')
const {
  createExistingSetupChannelSelection,
  createSetupChannelPickerPayload
} = require('../../../utils/setupChannelPicker')
const {
  runSetup
} = require('../../../utils/setupCommand')
const {
  createSetupProgressPayload
} = require('../../../utils/setupProgress')
const {
  logSetupRecoverable
} = require('../../../utils/setupLogging')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../../../utils/commandAccess')

function createSetupAccessChoiceInteractionSystem({ gameManager, saveServerConfigs, serverConfigs }) {
  const singleFlight = createSingleFlight({ ttlMs: 30000 })

  async function handleSetupAccessChoiceInteraction(interaction) {
    const parsed = parseSetupAccessChoiceCustomId(interaction.customId)
    if (!parsed) return null

    if (!hasAdministrator(interaction)) {
      return replyPrivateSystem(
        interaction,
        'Setup cancelled',
        'Only a server administrator or bot owner access user can choose setup visibility.',
        'Ask an administrator or the bot owner access user to press one of the setup buttons.'
      )
    }

    if (parsed.action === 'cancel') {
      return updateInteraction(interaction, { content: null, embeds: [], components: [] })
    }

    return runSetupAccessChoiceFlight(interaction, singleFlight, () => runSetupAccessChoice(interaction, parsed, {
      gameManager,
      saveServerConfigs,
      serverConfigs
    }))
  }

  return {
    getRuntimeState: (...args) => singleFlight.getRuntimeState(...args),
    handleSetupAccessChoiceInteraction
  }
}

async function runSetupAccessChoice(interaction, parsed, context) {
  if (parsed.mode === 'manual') {
    return updateInteraction(interaction, createSetupChannelPickerPayload(
      createExistingSetupChannelSelection(interaction.guild),
      { privateAccess: parsed.privateAccess }
    ))
  }

  const onProgress = createSetupProgressUpdater(interaction)
  await updateInteraction(interaction, createSetupProgressPayload())
  const result = await runSetup(interaction, context, { onProgress, privateAccess: parsed.privateAccess })
  return sendSetupChoiceResult(interaction, result)
}

async function runSetupAccessChoiceFlight(interaction, singleFlight, fn) {
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
    const edited = await editInteractionReply(interaction, payload).catch(err => logSetupRecoverable('edit-setup-access-progress-reply', err, createSetupAccessContext(interaction)))
    if (edited) return edited
  }

  if (interaction.message) {
    return queuedMessageEdit(interaction.message, payload).catch(err => logSetupRecoverable('edit-setup-access-progress-message', err, createSetupAccessContext(interaction)))
  }

  return null
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

function createSetupAccessContext(interaction) {
  return { guildId: interaction.guild?.id, messageId: interaction.message?.id, userId: interaction.user?.id }
}

module.exports = {
  createSetupAccessChoiceInteractionSystem,
  createSetupProgressUpdater,
  isSetupAccessChoiceInteraction,
  runSetupAccessChoiceFlight,
  updateSetupProgressMessage
}
