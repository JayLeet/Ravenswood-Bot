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
  findOrCreateAutoSetupCategory
} = require('../../../utils/setupAutoCategory')
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
  createExistingSetupChannelSelection,
  createSetupChannelPickerPayload,
  fillMissingSetupChannelSelection,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
} = require('../../../utils/setupChannelPicker')
const {
  collectManagedSetupIds
} = require('../../../utils/setupDelete')
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
      return handleChannelSelect(interaction, parsed, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.createMissing) {
      return handleCreateMissing(interaction, parsed, { saveServerConfigs, serverConfigs, stateByUser })
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

async function handleChannelSelect(interaction, parsed, stateByUser) {
  const selected = resolveSelectedChannel(interaction)
  const state = getPickerState(interaction, stateByUser, parsed)
  if (!selected) {
    return updatePicker(interaction, state.channels, {
      title: 'Channel not found',
      message: 'Discord did not include the selected channel. Pick it again or choose another channel.'
    }, state.privateAccess)
  }

  state.channels[parsed.key] = selected
  state.updatedAt = Date.now()
  return updatePicker(interaction, state.channels, null, state.privateAccess)
}

async function handleCreateMissing(interaction, parsed, context) {
  const state = getPickerState(interaction, context.stateByUser, parsed)
  let channels = normalizeSetupChannelSelection(state.channels)
  const parentResult = await findNewChannelParent(interaction, channels, state, context)
  if (!parentResult.ok) {
    return updatePicker(interaction, channels, {
      title: 'Category creation failed',
      message: 'I could not create or find the Ravenswood Bluff category. Check Manage Channels and try again.'
    }, state.privateAccess)
  }
  channels = fillMissingSetupChannelSelection(channels, interaction.guild, parentResult.parentId)

  for (const key of getMissingSetupChannelKeys(channels)) {
    const created = await createMissingSetupChannel(interaction, key, parentResult.parentId)
    if (!created) {
      return updatePicker(interaction, channels, {
        title: 'Channel creation failed',
        message: `I could not create ${SETUP_CHANNEL_PICKER_DETAILS[key].label}. Check Manage Channels and try again.`
      }, state.privateAccess)
    }
    channels[key] = created
    state.managedChannels[key] = created
    savePendingManagedSetup(interaction, state, context)
  }

  state.channels = channels
  state.updatedAt = Date.now()
  return updatePicker(interaction, state.channels, {
    title: 'Channels created',
    message: 'The setup channels were created or reused and selected.'
  }, state.privateAccess)
}

async function handleConfirm(interaction, context) {
  const state = getPickerState(interaction, context.stateByUser, parseSetupChannelsCustomId(interaction.customId))
  const selection = normalizeSetupChannelSelection(state.channels)
  const missing = getMissingSetupChannelKeys(selection)
  if (missing.length) {
    return updatePicker(interaction, selection, {
      title: 'More channels needed',
      message: `Choose or create: ${missing.map(key => SETUP_CHANNEL_PICKER_DETAILS[key].label).join(', ')}.`
    }, state.privateAccess)
  }

  const onProgress = createSetupProgressUpdater(interaction)
  await updateInteraction(interaction, createSetupProgressPayload())
  const result = await runSetup(interaction, context, {
    manualChannels: true,
    manualChannelSelection: selection,
    manualManagedChannels: state.managedChannels,
    onProgress,
    privateAccess: state.privateAccess
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

function updatePicker(interaction, selection, notice = null, privateAccess = false) {
  return updateInteraction(interaction, createSetupChannelPickerPayload(selection, { notice, privateAccess }))
}

function getPickerState(interaction, stateByUser, parsed = null) {
  const key = getStateKey(interaction)
  const existing = stateByUser.get(key)
  if (existing) {
    existing.managedCategories ??= {}
    existing.managedChannels ??= {}
    if (parsed?.accessSpecified) existing.privateAccess = parsed.privateAccess === true
    return existing
  }
  const created = {
    channels: createExistingSetupChannelSelection(interaction.guild),
    managedCategories: {},
    managedChannels: {},
    privateAccess: parsed?.privateAccess === true,
    updatedAt: Date.now()
  }
  stateByUser.set(key, created)
  return created
}

async function findNewChannelParent(interaction, channels, state, context) {
  const selected = SETUP_CHANNEL_PICKER_KEYS.map(key => channels[key]).find(Boolean)
  const selectedParentId = selected?.parentId || selected?.parent?.id || null
  if (selectedParentId) return { ok: true, parentId: selectedParentId }

  const result = await findOrCreateAutoSetupCategory(interaction.guild, { managedCategories: state.managedCategories })
  savePendingManagedSetup(interaction, state, context)
  if (!result.ok) return { ok: false, parentId: null }
  return { ok: true, parentId: result.category?.id || null }
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

function savePendingManagedSetup(interaction, state, context = {}) {
  const guildId = interaction.guild?.id
  if (!guildId || !context.serverConfigs?.set || !context.saveServerConfigs) return

  const previous = context.serverConfigs.get(guildId) || {}
  const tracked = collectManagedSetupIds({
    managedCategories: state.managedCategories,
    managedChannels: state.managedChannels
  })
  const next = {
    ...previous,
    setupManagedCategoryIds: uniqueIds([
      ...(Array.isArray(previous.setupManagedCategoryIds) ? previous.setupManagedCategoryIds : []),
      ...tracked.setupManagedCategoryIds
    ]),
    setupManagedChannelIds: uniqueIds([
      ...(Array.isArray(previous.setupManagedChannelIds) ? previous.setupManagedChannelIds : []),
      ...tracked.setupManagedChannelIds
    ])
  }
  context.serverConfigs.set(guildId, next)
  context.saveServerConfigs(context.serverConfigs)
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean).map(String))]
}

module.exports = {
  createSetupChannelsInteractionSystem,
  isSetupChannelsInteraction
}
