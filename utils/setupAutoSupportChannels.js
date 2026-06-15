const {
  ensureReservedNightAreaPool
} = require('../systems/discord/interactions/nightArea/reservedChannels')
const {
  ensureSetupSharedVoiceChannels
} = require('./setupVoiceChannels')
const {
  applyHiddenSpectatorCategoryAccess,
  applyReadOnlyGrimoireSpectatorCategoryAccess,
  applyStorytellerVoiceControlsToCategory
} = require('./setupCategoryPermissions')

async function prepareAutoSetupSupportChannels(guild, category, gameRoles, options = {}) {
  try {
    const [sharedVoice, cottagePool] = await Promise.all([
      ensureSetupSharedVoiceChannels(guild, category, gameRoles, options),
      ensureCottagePoolWithPermissions(guild, gameRoles, options)
    ])

    if (!sharedVoice.ok) return sharedVoice
    if (!cottagePool.ok) return cottagePool

    return {
      ok: true,
      cottageCategory: cottagePool.category,
      reservedNightVoiceChannels: cottagePool.channels,
      sharedVoiceChannels: sharedVoice.channels
    }
  } catch {
    return {
      ok: false,
      message: 'I could not prepare the shared voice channels or reserved cottage channels.'
    }
  }
}

async function ensureCottagePoolWithPermissions(guild, gameRoles, options = {}) {
  const cottagePool = await ensureReservedNightAreaPool(guild, options)
  if (!cottagePool.ok) return cottagePool

  await applyStorytellerVoiceControlsToCategory(cottagePool.category, gameRoles)
  await applyHiddenSpectatorCategoryAccess(cottagePool.category, gameRoles)
  await applyReadOnlyGrimoireSpectatorCategoryAccess(cottagePool.category, gameRoles)
  return cottagePool
}

module.exports = {
  prepareAutoSetupSupportChannels
}
