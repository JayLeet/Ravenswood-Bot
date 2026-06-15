const {
  ChannelType
} = require('discord.js')
const {
  createSingleFlight
} = require('../../../utils/discord/singleFlight')
const {
  queuedGuildChannelCreate
} = require('../../../utils/discord/channelActions')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../../../utils/commandAccess')
const {
  registerRuntimeMaintenanceTask
} = require('../../../utils/runtimeMaintenance')
const {
  runSetup
} = require('../../../utils/setupCommand')
const {
  logSetupRecoverable
} = require('../../../utils/setupLogging')
const {
  createSetupProgressPayload
} = require('../../../utils/setupProgress')
const {
  SETUP_CHANNEL_PICKER_ACTIONS,
  SETUP_CHANNEL_PICKER_DETAILS,
  SETUP_CHANNEL_PICKER_KEYS,
  createSetupChannelPickerPayload,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
} = require('../../../utils/setupChannelPicker')
const {
  acknowledgeInteraction,
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  createSetupProgressUpdater,
  runSetupAccessChoiceFlight
} = require('./setupAccessChoice')
const {
  sendSetupChoiceResult
} = require('./setupUnsafeRoles')

const PICKER_STATE_TTL_MS = 30 * 60 * 1000

function createSetupChannelsInteractionSystem({ gameManager, saveServerConfigs, serverConfigs }) {
  const stateByUser = new Map()
  const singleFlight = createSingleFlight({ ttlMs: 30000 })

  registerRuntimeMaintenanceTask('setupChannelPicker', () => ({ removed: pruneState(stateByUser), size: stateByUser.size }))

  async function handleSetupChannelsInteraction(interaction) {
    const parsed = parseSetupChannelsCustomId(interaction.customId)
    if (!parsed) return null

    pruneState(stateByUser)
    if (!hasAdministrator(interaction)) {
      return replyPrivateSystem(
        interaction,
        'Setup channels blocked',
        'Only a server administrator or bot owner access user can choose setup channels.',
        'Ask an administrator or the bot owner access user to use this setup picker.'
      )
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.cancel) {
      stateByUser.delete(getStateKey(interaction))
      return updateInteraction(interaction, { content: null, embeds: [], components: [] })
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.select) {
      return handleChannelSelect(interaction, parsed.key, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.createMissing) {
      return handleCreateMissing(interaction, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.confirm) {
      return runSetupAccessChoiceFlight(interaction, singleFlight, () => handleConfirm(interaction, {
        gameManager,
        saveServerConfigs,
        serverConfigs,
        stateByUser
      }))
    }

    return acknowledgeInteraction(interaction)
  }

  return {
    getRuntimeState: (...args) => singleFlight.getRuntimeState(...args),
    handleSetupChannelsInteraction
  }
}

async function handleChannelSelect(interaction, key, stateByUser) {
  const selected = resolveSelectedChannel(interaction)
  const state = getPickerState(interaction, stateByUser)
  if (!selected) {
    return updatePicker(interaction, state.channels, {
      title: 'Channel not found',
      message: 'Discord did not include the selected channel. Pick it again or choose another channel.'
    })
  }

  state.channels[key] = selected
  state.updatedAt = Date.now()
  return updatePicker(interaction, state.channels)
}

async function handleCreateMissing(interaction, stateByUser) {
  const state = getPickerState(interaction, stateByUser)
  const channels = normalizeSetupChannelSelection(state.channels)
  const parent = findNewChannelParent(interaction, channels)

  for (const key of getMissingSetupChannelKeys(channels)) {
    const created = await createMissingSetupChannel(interaction, key, parent)
    if (!created) {
      return updatePicker(interaction, channels, {
        title: 'Channel creation failed',
        message: `I could not create ${SETUP_CHANNEL_PICKER_DETAILS[key].label}. Check Manage Channels and try again.`
      })
    }
    channels[key] = created
  }

  state.channels = channels
  state.updatedAt = Date.now()
  return updatePicker(interaction, state.channels, {
    title: 'Channels created',
    message: 'The missing setup channels were created and selected.'
  })
}

async function handleConfirm(interaction, context) {
  const state = getPickerState(interaction, context.stateByUser)
  const selection = normalizeSetupChannelSelection(state.channels)
  const missing = getMissingSetupChannelKeys(selection)
  if (missing.length) {
    return updatePicker(interaction, selection, {
      title: 'More channels needed',
      message: `Choose or create: ${missing.map(key => SETUP_CHANNEL_PICKER_DETAILS[key].label).join(', ')}.`
    })
  }

  const onProgress = createSetupProgressUpdater(interaction)
  await updateInteraction(interaction, createSetupProgressPayload())
  const result = await runSetup(interaction, context, {
    manualChannels: true,
    manualChannelSelection: selection,
    onProgress
  })
  context.stateByUser.delete(getStateKey(interaction))
  return sendSetupChoiceResult(interaction, result)
}

async function createMissingSetupChannel(interaction, key, parent) {
  const config = SETUP_CHANNEL_PICKER_DETAILS[key].createConfig
  return queuedGuildChannelCreate(interaction.guild, {
    name: config.name,
    parent,
    reason: config.reason,
    type: ChannelType.GuildText
  }).catch(err => {
    logSetupRecoverable('create-manual-setup-picker-channel', err, {
      guildId: interaction.guild?.id,
      name: config.name,
      userId: interaction.user?.id
    })
    return null
  })
}

function updatePicker(interaction, selection, notice = null) {
  return updateInteraction(interaction, createSetupChannelPickerPayload(selection, { notice }))
}

function getPickerState(interaction, stateByUser) {
  const key = getStateKey(interaction)
  const existing = stateByUser.get(key)
  if (existing) return existing
  const created = { channels: {}, updatedAt: Date.now() }
  stateByUser.set(key, created)
  return created
}

function findNewChannelParent(interaction, channels) {
  const selected = SETUP_CHANNEL_PICKER_KEYS.map(key => channels[key]).find(Boolean)
  return selected?.parentId || selected?.parent?.id || interaction.channel?.parentId || null
}

function resolveSelectedChannel(interaction) {
  const selectedId = interaction.values?.[0]
  return interaction.channels?.get?.(selectedId) ||
    interaction.channels?.first?.() ||
    interaction.guild?.channels?.cache?.get?.(selectedId) ||
    null
}

function getStateKey(interaction) {
  return `${interaction.guild?.id || 'dm'}:${interaction.user?.id || interaction.member?.id}`
}

function pruneState(stateByUser, now = Date.now()) {
  let removed = 0
  for (const [key, state] of stateByUser.entries()) {
    if (now - (state.updatedAt || 0) < PICKER_STATE_TTL_MS) continue
    stateByUser.delete(key)
    removed += 1
  }
  return removed
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = {
  createSetupChannelsInteractionSystem,
  isSetupChannelsInteraction
}
