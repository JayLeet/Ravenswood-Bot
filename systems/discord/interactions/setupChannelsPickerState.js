const {
  createExistingSetupCategory,
  createExistingSetupChannelSelection,
  normalizeSetupChannelSelection
} = require('../../../utils/setupChannelPicker')
const {
  ensureManagedTracking
} = require('../../../utils/setupPendingManagedIds')

const PICKER_STATE_TTL_MS = 30 * 60 * 1000

function getPickerState(interaction, stateByUser, parsed = null) {
  const key = getStateKey(interaction)
  const existing = stateByUser.get(key)
  if (existing) {
    ensureManagedTracking(existing)
    if (parsed?.accessSpecified) existing.privateAccess = parsed.privateAccess === true
    return existing
  }

  const category = createExistingSetupCategory(interaction.guild)
  const created = {
    category,
    channels: category ? createExistingSetupChannelSelection(interaction.guild, category.id) : normalizeSetupChannelSelection(),
    managedCategories: {},
    managedCategoryIds: [],
    managedChannels: {},
    managedChannelIds: [],
    gameLogSaveMode: null,
    privateAccess: parsed?.privateAccess === true,
    updatedAt: Date.now()
  }
  stateByUser.set(key, created)
  return created
}

function setPickerCategory(state, guild, category) {
  state.category = category || null
  state.channels = category
    ? createExistingSetupChannelSelection(guild, category.id)
    : normalizeSetupChannelSelection()
  state.updatedAt = Date.now()
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

module.exports = {
  getPickerState,
  getStateKey,
  pruneState,
  setPickerCategory
}
