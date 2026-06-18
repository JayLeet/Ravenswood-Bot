const { ChannelType } = require('discord.js')
const {
  AUTO_SETUP_CATEGORY_NAME,
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  BOT_UPDATE_CHANNEL_NAME,
  SETUP_TEXT_CHANNEL_ORDER
} = require('./setupAutoChannelDefinitions')
const {
  getOrCreateBotUpdateChannel
} = require('./botUpdateChannel')
const {
  resetAutoSetupCategories
} = require('./setupAutoCategoryReset')
const {
  findOrCreateAutoSetupCategory
} = require('./setupAutoCategory')
const { ensureSetupSharedVoiceChannels } = require('./setupVoiceChannels')
const { queuedGuildChannelCreate } = require('./discord/channelActions')
const {
  getCachedGuildChannels
} = require('./discord/cacheValues')
const {
  setChannelParentIfChanged,
  setGuildChannelPositionsIfChanged
} = require('./discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('./discord/permissionOverwriteSignature')
const {
  applyBotSetupCategoryAccess,
  applySetupCategoryRoleAccess,
  createSetupCategoryRoleOverwrites
} = require('./setupCategoryPermissions')
const {
  LOCKED_GAME_PANEL_DENIES,
  READ_ONLY_TEXT_DENIES,
  createChannelOverwrites,
  getGameRoles
} = require('./setupTextChannelPermissions')
const { validateSetupPermissionOverwriteTargets } = require('./setupPermissionOverwritePreflight')
const {
  GRIMOIRE_SPECTATOR_ROLE_NAME,
  ensureGrimoireSpectatorRole
} = require('./grimoireSpectatorRole')
const {
  prepareAutoSetupSupportChannels
} = require('./setupAutoSupportChannels')
const {
  logSetupRecoverable
} = require('./setupLogging')
const {
  createCategoryAccessFailureMessage,
  createCategoryCreationFailureMessage,
  createCategoryRoleAccessFailureMessage,
  createTextChannelFailureMessage
} = require('./setupAutoChannelFailureMessages')
const {
  hasAllSetupChannelOptions,
  hasAnySetupChannelOption
} = require('./setupChannelOptions')

async function createAutoSetupChannels(guild, gameManager, options = {}) {
  const previousConfig = options.previousConfig || {}
  const managedChannels = options.managedChannels || {}
  const managedCategories = options.managedCategories || {}
  const managedOptions = {
    managedChannels,
    managedCategories,
    onManagedCategory: options.onManagedCategory,
    onManagedChannel: options.onManagedChannel
  }
  const reset = await resetAutoSetupCategories(guild, {
    preserveChannelIds: [previousConfig.botUpdateChannelId].filter(Boolean)
  })
  if (!reset.ok) return reset

  const rolesReady = await ensureSetupRoles(guild, gameManager)
  if (!rolesReady.ok) return rolesReady

  const gameRoles = getGameRoles(guild, gameManager)
  const overwriteTargets = Object.values(AUTO_SETUP_CHANNELS)
    .concat(AUTO_SETUP_GAME_LOG_CHANNEL)
    .flatMap(config => createChannelOverwrites(guild, config, gameRoles))
  const overwriteValidation = validateSetupPermissionOverwriteTargets(guild, overwriteTargets)
  if (!overwriteValidation.ok) return overwriteValidation

  const categoryResult = await findOrCreateAutoSetupCategory(guild, managedOptions)
  if (!categoryResult.ok) {
    return {
      ok: false,
      message: createCategoryCreationFailureMessage(guild, categoryResult.error)
    }
  }
  const category = categoryResult.category

  const categoryOverwriteValidation = validateSetupPermissionOverwriteTargets(
    guild,
    createSetupCategoryRoleOverwrites(gameRoles)
  )
  if (!categoryOverwriteValidation.ok) return categoryOverwriteValidation

  const botCategoryAccessReady = await applyBotSetupCategoryAccess(category, guild)
  if (!botCategoryAccessReady.ok) {
    return {
      ok: false,
      message: createCategoryAccessFailureMessage(guild, category, botCategoryAccessReady.error)
    }
  }
  const categoryRoleAccessReady = await applySetupCategoryRoleAccess(category, guild, gameRoles)
  if (!categoryRoleAccessReady.ok) {
    return {
      ok: false,
      message: createCategoryRoleAccessFailureMessage(guild, category, categoryRoleAccessReady)
    }
  }
  const botUpdateChannelMovedByReset = reset.preservedChannelIds?.includes?.(String(previousConfig.botUpdateChannelId))
  const botUpdateChannelResult = await getOrCreateBotUpdateChannel(guild, previousConfig, {
    category,
    moveConfiguredChannelToCategory: botUpdateChannelMovedByReset,
    requireBotChannelAccess: true
  })
  if (botUpdateChannelResult.ok === false) {
    return { ok: false, message: botUpdateChannelResult.message }
  }

  const botUpdateChannel = botUpdateChannelResult.channel
  if (botUpdateChannelResult.source === 'created') {
    managedChannels.botUpdateChannel = botUpdateChannel
    options.onManagedChannel?.(botUpdateChannel, 'botUpdateChannel')
  }
  const channels = {}

  for (const config of [...Object.values(AUTO_SETUP_CHANNELS), AUTO_SETUP_GAME_LOG_CHANNEL]) {
    const channel = await findOrCreateTextChannel(guild, category, config, gameRoles, managedOptions)
    if (!channel) {
      return {
        ok: false,
        message: createTextChannelFailureMessage(config, category, guild, createChannelOverwrites(guild, config, gameRoles))
      }
    }
    channels[config.key] = channel
  }
  if (botUpdateChannel) channels.botUpdateChannel = botUpdateChannel

  await orderSetupTextChannels(guild, channels)

  const supportChannelsReady = prepareAutoSetupSupportChannels(guild, category, gameRoles, managedOptions)

  return { ok: true, autoCreated: true, category, channels, managedCategories, managedChannels, supportChannelsReady }
}

async function ensurePostGameChannel(guild, category, gameManager = null, options = {}) {
  return ensureSupportTextChannel(guild, category, gameManager, AUTO_SETUP_CHANNELS.postGame, options)
}

async function ensureGameLogChannel(guild, category, gameManager = null, options = {}) {
  return ensureSupportTextChannel(guild, category, gameManager, AUTO_SETUP_GAME_LOG_CHANNEL, options)
}

async function ensurePlayerGrimoireChannel(guild, category, gameManager = null, options = {}) {
  return ensureSupportTextChannel(guild, category, gameManager, AUTO_SETUP_CHANNELS.playerGrimoire, options)
}

async function ensureSetupTextChannels(guild, category, gameManager = null, options = {}) {
  const rolesReady = await ensureSetupRoles(guild, gameManager)
  if (!rolesReady.ok) return rolesReady

  const gameRoles = getGameRoles(guild, gameManager)
  const channels = {}
  for (const config of Object.values(AUTO_SETUP_CHANNELS)) {
    const channel = await findOrCreateTextChannel(guild, category, config, gameRoles, options)
    if (!channel) return { ok: false, message: createTextChannelFailureMessage(config, category, guild, createChannelOverwrites(guild, config, gameRoles)) }
    channels[config.key] = channel
  }
  await orderSetupTextChannels(guild, channels)
  return { ok: true, channels }
}

async function refreshGameLogChannel(guild, channel, gameManager = null) {
  if (!channel) return null
  const rolesReady = await ensureSetupRoles(guild, gameManager)
  if (!rolesReady.ok) return null
  const gameRoles = getGameRoles(guild, gameManager)
  const overwrites = createChannelOverwrites(guild, AUTO_SETUP_GAME_LOG_CHANNEL, gameRoles)
  await setPermissionOverwritesIfChanged(channel, overwrites)
    .catch(err => logSetupRecoverable('refresh-manual-game-log-channel-permissions', err, createAutoChannelContext(channel, channel.parent)))
  return channel
}

async function ensureSupportTextChannel(guild, category, gameManager, config, options = {}) {
  let gameRoles = {}

  if (gameManager) {
    const rolesReady = await ensureSetupRoles(guild, gameManager)
    if (!rolesReady.ok) return null
    gameRoles = getGameRoles(guild, gameManager)
  }

  return findOrCreateTextChannel(guild, category, config, gameRoles, options)
}

async function ensureSetupVoiceChannels(guild, category, gameManager, options = {}) {
  const rolesReady = await ensureSetupRoles(guild, gameManager)
  if (!rolesReady.ok) return rolesReady

  return ensureSetupSharedVoiceChannels(guild, category, getGameRoles(guild, gameManager), options)
}

async function ensureSetupRoles(guild, gameManager) {
  const rolesReady = await gameManager.ensureGameRoles(guild)
  if (!rolesReady.ok) return { ok: false, message: rolesReady.message }

  const grimRole = await ensureGrimoireSpectatorRole(guild)
  if (!grimRole) {
    return { ok: false, message: `I could not create or find the ${GRIMOIRE_SPECTATOR_ROLE_NAME} role.` }
  }

  return { ok: true }
}

async function findOrCreateTextChannel(guild, category, config, gameRoles, options = {}) {
  const overwrites = createChannelOverwrites(guild, config, gameRoles)
  const existing = getCachedGuildChannels(guild).find(channel =>
    channel.type === ChannelType.GuildText &&
    channel.name === config.name
  )

  if (existing) {
    await setChannelParentIfChanged(existing, category?.id || null, { lockPermissions: false }).catch(err => logSetupRecoverable('refresh-auto-setup-text-channel-parent', err, createAutoChannelContext(existing, category)))
    if (overwrites.length) await setPermissionOverwritesIfChanged(existing, overwrites).catch(err => logSetupRecoverable('refresh-auto-setup-text-channel-permissions', err, createAutoChannelContext(existing, category)))
    return existing
  }

  return queuedGuildChannelCreate(guild, {
    name: config.name,
    type: ChannelType.GuildText,
    parent: category?.id || null,
    reason: config.reason,
    permissionOverwrites: overwrites
  }).then(channel => {
    if (options.managedChannels && config.key) options.managedChannels[config.key] = channel
    options.onManagedChannel?.(channel, config.key)
    return channel
  }).catch(err => logSetupRecoverable('create-auto-setup-text-channel', err, { categoryId: category?.id, guildId: guild.id, name: config.name }))
}

async function orderSetupTextChannels(guild, channels) {
  const ordered = SETUP_TEXT_CHANNEL_ORDER.map(key => channels[key]).filter(Boolean)
  const positions = ordered.map((channel, index) => ({ channel: channel.id, position: index }))
  await setGuildChannelPositionsIfChanged(guild, positions).catch(err => logSetupRecoverable('order-auto-setup-text-channels', err, { guildId: guild.id }))
}

function createAutoChannelContext(channel, category = null) {
  return { categoryId: category?.id, channelId: channel?.id, guildId: channel?.guildId || channel?.guild?.id }
}

module.exports = {
  AUTO_SETUP_CATEGORY_NAME,
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  BOT_UPDATE_CHANNEL_NAME,
  LOCKED_GAME_PANEL_DENIES,
  READ_ONLY_TEXT_DENIES,
  SETUP_TEXT_CHANNEL_ORDER,
  createAutoSetupChannels,
  ensureGameLogChannel,
  ensurePlayerGrimoireChannel,
  ensurePostGameChannel,
  ensureSetupRoles,
  ensureSetupTextChannels,
  ensureSetupVoiceChannels,
  hasAllSetupChannelOptions,
  hasAnySetupChannelOption,
  refreshGameLogChannel
}
