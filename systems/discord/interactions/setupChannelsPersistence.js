const {
  mergeSetupIds,
  uniqueSetupIds
} = require('../../../utils/setupManagedIds')

function ensureManagedTracking(state) {
  state.managedCategories ??= {}
  state.managedCategoryIds ??= []
  state.managedChannels ??= {}
  state.managedChannelIds ??= []
  return state
}

function trackPendingManagedCategory(interaction, state, context, category) {
  if (!category?.id) return
  ensureManagedTracking(state)
  state.managedCategoryIds = uniqueSetupIds([...state.managedCategoryIds, category.id])
  savePendingManagedSetup(interaction, state, context)
}

function trackPendingManagedChannel(interaction, state, context, channel) {
  if (!channel?.id) return
  ensureManagedTracking(state)
  state.managedChannelIds = uniqueSetupIds([...state.managedChannelIds, channel.id])
  savePendingManagedSetup(interaction, state, context)
}

function savePendingManagedSetup(interaction, state, context = {}) {
  const guildId = interaction.guild?.id
  if (!guildId || !context.serverConfigs?.set || !context.saveServerConfigs) return

  ensureManagedTracking(state)
  const categoryIds = uniqueSetupIds(state.managedCategoryIds)
  const channelIds = uniqueSetupIds(state.managedChannelIds)
  if (!categoryIds.length && !channelIds.length) return

  const previous = context.serverConfigs.get(guildId) || {}
  const next = {
    ...previous,
    setupManagedCategoryIds: mergeSetupIds(previous, 'setupManagedCategoryIds', categoryIds),
    setupManagedChannelIds: mergeSetupIds(previous, 'setupManagedChannelIds', channelIds)
  }
  context.serverConfigs.set(guildId, next)
  context.saveServerConfigs(context.serverConfigs)
}

module.exports = {
  ensureManagedTracking,
  trackPendingManagedCategory,
  trackPendingManagedChannel
}
