const {
  ChannelType
} = require('discord.js')
const {
  createSingleFlight
} = require('../../../utils/discord/singleFlight')
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
  createSetupProgressPayload
} = require('../../../utils/setupProgress')
const {
  SETUP_CHANNEL_PICKER_ACTIONS,
  SETUP_CHANNEL_PICKER_DETAILS,
  SETUP_GAME_LOG_SAVE_MODES,
  createSetupChannelPickerPayload,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  isSetupManualReady,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
} = require('../../../utils/setupChannelPicker')
const {
  acknowledgeInteraction,
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  trackPendingManagedCategory
} = require('../../../utils/setupPendingManagedIds')
const {
  createSetupProgressUpdater,
  runSetupAccessChoiceFlight
} = require('./setupAccessChoice')
const {
  sendSetupChoiceResult
} = require('./setupUnsafeRoles')
const {
  getPickerState,
  getStateKey,
  pruneState,
  setPickerCategory
} = require('./setupChannelsPickerState')

function createSetupChannelsInteractionSystem({ gameManager, saveServerConfigs, serverConfigs }) {
  const stateByUser = new Map()
  const singleFlight = createSingleFlight({ ttlMs: 30000 })

  registerRuntimeMaintenanceTask('setupChannelPicker', () => ({ removed: pruneState(stateByUser), size: stateByUser.size }))

  async function handleSetupChannelsInteraction(interaction) {
    const parsed = parseSetupChannelsCustomId(interaction.customId)
    if (!parsed) return null

    pruneState(stateByUser)
    if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
      return replyPrivateSystem(
        interaction,
        'Manual setup blocked',
        'Only a server administrator or bot owner access user can choose manual setup.',
        'Ask an administrator or the bot owner access user to use this manual setup picker.'
      )
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.cancel) {
      stateByUser.delete(getStateKey(interaction))
      return updateInteraction(interaction, { content: null, embeds: [], components: [] })
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.changeCategory) {
      return handleChangeCategory(interaction, parsed, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.createCategory) {
      return handleCreateCategory(interaction, parsed, { saveServerConfigs, serverConfigs, stateByUser })
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.selectCategory) {
      return handleCategorySelect(interaction, parsed, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.select) {
      return handleChannelSelect(interaction, parsed, stateByUser)
    }

    if (parsed.action === SETUP_CHANNEL_PICKER_ACTIONS.logMode) {
      return handleLogMode(interaction, parsed, stateByUser)
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
  if (!state.category) {
    return updatePicker(interaction, state, {
      title: 'Category needed',
      message: 'Choose the setup category before selecting the Waiting Room or game-log archive.'
    })
  }
  if (!selected) {
    return updatePicker(interaction, state, {
      title: 'Channel not found',
      message: 'Discord did not include the selected channel. Pick it again or choose another channel.'
    })
  }
  const detail = SETUP_CHANNEL_PICKER_DETAILS[parsed.key]
  if (!detail?.channelTypes?.includes?.(selected.type)) {
    return updatePicker(interaction, state, {
      title: 'Wrong channel type',
      message: `${detail?.label || 'That selection'} must use the expected Discord channel type.`
    })
  }

  state.channels[parsed.key] = selected
  state.updatedAt = Date.now()
  return updatePicker(interaction, state)
}

async function handleLogMode(interaction, parsed, stateByUser) {
  const state = getPickerState(interaction, stateByUser, parsed)
  if (!Object.values(SETUP_GAME_LOG_SAVE_MODES).includes(parsed.key)) {
    return updatePicker(interaction, state, {
      title: 'Unknown save mode',
      message: 'Choose whether game logs should save automatically or wait for a Storyteller button.'
    })
  }

  state.gameLogSaveMode = parsed.key
  state.updatedAt = Date.now()
  return updatePicker(interaction, state)
}

async function handleCategorySelect(interaction, parsed, stateByUser) {
  const selected = resolveSelectedChannel(interaction)
  const state = getPickerState(interaction, stateByUser, parsed)
  if (!selected || selected.type !== ChannelType.GuildCategory) {
    return updatePicker(interaction, state, {
      title: 'Category not found',
      message: 'Discord did not include the selected category. Pick it again or create the Ravenswood Bluff category.'
    })
  }
  setPickerCategory(state, interaction.guild, selected)
  return updatePicker(interaction, state)
}

async function handleChangeCategory(interaction, parsed, stateByUser) {
  const state = getPickerState(interaction, stateByUser, parsed)
  setPickerCategory(state, interaction.guild, null)
  return updatePicker(interaction, state)
}

async function handleCreateCategory(interaction, parsed, context) {
  const state = getPickerState(interaction, context.stateByUser, parsed)
  const result = await findOrCreateAutoSetupCategory(interaction.guild, { managedCategories: state.managedCategories })
  if (!result.ok || !result.category) {
    return updatePicker(interaction, state, {
      title: 'Category creation failed',
      message: 'I could not create or find the Ravenswood Bluff category. Check Manage Channels and try again.'
    })
  }
  if (String(state.managedCategories.setupCategory?.id || '') === String(result.category.id)) {
    trackPendingManagedCategory(interaction, state, context, result.category)
  }
  setPickerCategory(state, interaction.guild, result.category)
  return updatePicker(interaction, state, {
    title: 'Category selected',
    message: `BOTC setup channels will be created or reused inside <#${result.category.id}>.`
  })
}

async function handleConfirm(interaction, context) {
  const state = getPickerState(interaction, context.stateByUser, parseSetupChannelsCustomId(interaction.customId))
  const selection = normalizeSetupChannelSelection(state.channels)
  const missing = getMissingSetupChannelKeys(selection)
  if (!state.category) {
    return updatePicker(interaction, state, {
      title: 'Category needed',
      message: 'Choose the setup category before continuing setup.'
    })
  }
  if (missing.length) {
    return updatePicker(interaction, state, {
      title: 'More channels needed',
      message: `Choose: ${missing.map(key => SETUP_CHANNEL_PICKER_DETAILS[key].label).join(', ')}.`
    })
  }
  if (!isSetupManualReady(selection, state.gameLogSaveMode)) {
    return updatePicker(interaction, state, {
      title: 'Game-log save mode needed',
      message: 'Choose whether game logs should save automatically or wait for a Storyteller button.'
    })
  }

  const onProgress = createSetupProgressUpdater(interaction)
  await updateInteraction(interaction, createSetupProgressPayload())
  const result = await runSetup(interaction, context, {
    manualChannels: true,
    manualChannelSelection: {
      ...selection,
      category: state.category,
      gameLogSaveMode: state.gameLogSaveMode
    },
    manualManagedChannels: state.managedChannels,
    onProgress,
    privateAccess: state.privateAccess
  })
  context.stateByUser.delete(getStateKey(interaction))
  return sendSetupChoiceResult(interaction, result)
}

function updatePicker(interaction, state, notice = null) {
  return updateInteraction(interaction, createSetupChannelPickerPayload(state.channels, {
    category: state.category,
    gameLogSaveMode: state.gameLogSaveMode,
    notice,
    privateAccess: state.privateAccess
  }))
}

function resolveSelectedChannel(interaction) {
  const selectedId = interaction.values?.[0]
  return interaction.channels?.get?.(selectedId) ||
    interaction.channels?.first?.() ||
    interaction.guild?.channels?.cache?.get?.(selectedId) ||
    null
}

module.exports = {
  createSetupChannelsInteractionSystem,
  isSetupChannelsInteraction
}
