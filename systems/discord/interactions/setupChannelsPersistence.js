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
  state.managedCategoryIds = uniqueIds([...state.managedCategoryIds, category.id])
  savePendingManagedSetup(interaction, state, context)
}

function trackPendingManagedChannel(interaction, state, context, channel) {
  if (!channel?.id) return
  ensureManagedTracking(state)
  state.managedChannelIds = uniqueIds([...state.managedChannelIds, channel.id])
  savePendingManagedSetup(interaction, state, context)
}

function savePendingManagedSetup(interaction, state, context = {}) {
  const guildId = interaction.guild?.id
  if (!guildId || !context.serverConfigs?.set || !context.saveServerConfigs) return

  ensureManagedTracking(state)
  const categoryIds = uniqueIds(state.managedCategoryIds)
  const channelIds = uniqueIds(state.managedChannelIds)
  if (!categoryIds.length && !channelIds.length) return

  const previous = context.serverConfigs.get(guildId) || {}
  const next = {
    ...previous,
    setupManagedCategoryIds: uniqueIds([
      ...(Array.isArray(previous.setupManagedCategoryIds) ? previous.setupManagedCategoryIds : []),
      ...categoryIds
    ]),
    setupManagedChannelIds: uniqueIds([
      ...(Array.isArray(previous.setupManagedChannelIds) ? previous.setupManagedChannelIds : []),
      ...channelIds
    ])
  }
  context.serverConfigs.set(guildId, next)
  context.saveServerConfigs(context.serverConfigs)
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean).map(String))]
}

module.exports = {
  ensureManagedTracking,
  trackPendingManagedCategory,
  trackPendingManagedChannel
}
