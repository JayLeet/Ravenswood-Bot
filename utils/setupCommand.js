const {
  getMissingBotPermissions,
  getMissingBotSetupPermissions,
  formatMissingBotPermissions
} = require('../systems/discord/permissions')
const { ensureReservedNightAreaPool } = require('../systems/discord/interactions/nightArea/reservedChannels')
const { queuedMessageDelete } = require('./discord/messageActions')
const { getCleanupChannels } = require('./channelCleanup')
const {
  createAutoSetupChannels,
  ensureGameLogChannel,
  ensurePlayerGrimoireChannel,
  ensurePostGameChannel,
  ensureSetupRoles,
  ensureSetupVoiceChannels
} = require('./setupAutoChannels')
const {
  findExistingAutoSetupCategory
} = require('./setupAutoCategory')
const {
  deleteOldSetupPanelMessages,
  postSetupPanelMessages
} = require('./setupPanelMessages')
const { applyPrivateSetupAccess } = require('./setupPrivateAccess')
const { applyBotChannelAccess } = require('./botChannelAccess')
const { collectManagedSetupIds } = require('./setupDelete')
const { notifySetupProgress } = require('./setupProgress')
const {
  createSetupSuccessMessage
} = require('./setupSuccessMessage')
const {
  createUnsafeSetupRolePayload,
  findUnsafeSetupRoles
} = require('./setupUnsafeRoles')
const { logSetupRecoverable } = require('./setupLogging')
const { hasAdministratorOrGlobalCommandAccess } = require('./commandAccess')
const { mergeSetupIds } = require('./setupManagedIds')

const SETUP_CHANNEL_OPTION_NAMES = Object.freeze({ gameChannel: 'game-channel', liveChannel: 'live-channel', spectatorChannel: 'spectator-channel', storytellerChannel: 'storyteller-channel' })

async function runSetup(interaction, ctx, options = {}) {
  if (!hasAdministrator(interaction)) {
    return { ok: false, error: { message: 'Only a server administrator or bot owner access user can run setup.' } }
  }

  const missingSetupPermissions = getMissingBotSetupPermissions(interaction.guild)
  if (missingSetupPermissions.length) {
    return { ok: false, error: { message: formatMissingBotPermissions(missingSetupPermissions) } }
  }

  const preflight = await preflightUnsafeSetupRoles(interaction.guild, ctx.gameManager, options)
  if (preflight) return preflight

  const existingSetupCategory = await findExistingAutoSetupCategory(interaction.guild)
  const missingCategoryPermissions = getMissingBotSetupPermissions(interaction.guild, {
    existingSetupCategory
  })
  if (missingCategoryPermissions.length) {
    return { ok: false, error: { message: formatMissingBotPermissions(missingCategoryPermissions) } }
  }

  await notifySetupProgress(options, 'safety')
  const previousConfig = ctx.serverConfigs.get(interaction.guild.id)
  const setupOptions = { ...options, previousConfig }

  const setupResult = setupOptions.manualChannels
    ? await getManualSetupChannels(interaction, ctx.gameManager, setupOptions.manualChannelSelection, setupOptions)
    : await createAutoSetupChannels(interaction.guild, ctx.gameManager, setupOptions)
  setupResult.privateAccess = !!setupOptions.privateAccess

  if (!setupResult.ok) return { ok: false, error: { message: setupResult.message } }
  if (options.bypassUnsafeRoles) setupResult.bypassUnsafeRoles = true
  await notifySetupProgress(options, 'channels')
  return saveSetupChannels(interaction, ctx, setupResult, options)
}

async function preflightUnsafeSetupRoles(guild, gameManager, options = {}) {
  if (options.bypassUnsafeRoles) return null
  await guild.roles.fetch?.().catch(err => logSetupRecoverable('fetch-setup-roles-before-safety-check', err, { guildId: guild.id }))
  const unsafe = findUnsafeSetupRoles(guild, gameManager, {
    includeBotcAccessRole: !!options.privateAccess
  })
  if (!unsafe.length) return null
  return {
    ok: true,
    ...createUnsafeSetupRolePayload(unsafe, { privateAccess: !!options.privateAccess })
  }
}

async function getManualSetupChannels(interaction, gameManager = null, selection = null, options = {}) {
  const managedChannels = { ...(options.manualManagedChannels || {}) }
  const managedCategories = {}
  const channels = selection || {
    gameChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.gameChannel),
    liveChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.liveChannel),
    spectatorChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.spectatorChannel),
    storytellerChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.storytellerChannel)
  }

  if (Object.values(channels).some(channel => !channel)) {
    return {
      ok: false,
      message: 'Choose all four setup channels in the setup-channel picker, or use `/setup` to create the Ravenswood Bluff setup automatically.'
    }
  }

  const category = getManualSetupCategory(interaction.guild, channels)
  const managedOptions = { managedChannels, managedCategories }
  const postGameChannel = await ensurePostGameChannel(interaction.guild, category, gameManager, managedOptions)
  if (!postGameChannel) return { ok: false, message: 'I could not create the post-game reveal channel.' }

  const gameLogChannel = await ensureGameLogChannel(interaction.guild, category, gameManager, managedOptions)
  if (!gameLogChannel) return { ok: false, message: 'I could not create the game-log archive channel.' }

  const playerGrimoireChannel = await ensurePlayerGrimoireChannel(interaction.guild, category, gameManager, managedOptions)
  if (!playerGrimoireChannel) return { ok: false, message: 'I could not create the player grimoire channel.' }

  const sharedVoice = await ensureSetupVoiceChannels(interaction.guild, category, gameManager, managedOptions)
  if (!sharedVoice.ok) return sharedVoice

  return {
    ok: true,
    channels: { ...channels, gameLogChannel, playerGrimoireChannel, postGameChannel },
    managedCategories,
    managedChannels,
    sharedVoiceChannels: sharedVoice.channels,
    autoCreated: false
  }
}

function getManualSetupCategory(guild, channels) {
  const channel = Object.values(channels).find(item => item?.parent || item?.parentId)
  if (!channel) return null
  return channel.parent || guild?.channels?.cache?.get?.(channel.parentId) || null
}

async function saveSetupChannels(interaction, ctx, setupResult, options = {}) {
  const {
    gameChannel,
    gameLogChannel,
    liveChannel,
    playerGrimoireChannel,
    postGameChannel,
    spectatorChannel,
    storytellerChannel
  } = setupResult.channels
  const channels = [gameChannel, gameLogChannel, liveChannel, playerGrimoireChannel, postGameChannel, spectatorChannel, storytellerChannel]

  const validation = validateSetupChannels(interaction, channels)
  if (!validation.ok) return validation
  await notifySetupProgress(options, 'validation')

  const rolesReady = setupResult.autoCreated ? { ok: true } : await ensureSetupRoles(interaction.guild, ctx.gameManager)
  if (!rolesReady.ok) return { ok: false, error: { message: rolesReady.message } }
  await notifySetupProgress(options, 'roles')

  const unsafe = findUnsafeSetupRoles(interaction.guild, ctx.gameManager, {
    includeBotcAccessRole: !!setupResult.privateAccess
  })
  if (unsafe.length && !setupResult.bypassUnsafeRoles) {
    return {
      ok: true,
      ...createUnsafeSetupRolePayload(unsafe, { privateAccess: setupResult.privateAccess })
    }
  }

  const panels = await postSetupPanelMessages({ gameChannel, playerGrimoireChannel })
  if (!panels.ok) return { ok: false, error: { message: panels.message } }
  await notifySetupProgress(options, 'panel')

  const supportReady = await finishSetupSupportChannels(interaction, setupResult)
  if (!supportReady.ok) {
    await deletePostedSetupPanels(panels, 'cleanup-setup-panels-after-support-failure')
    return { ok: false, error: { message: supportReady.message } }
  }
  await notifySetupProgress(options, 'support')

  if (!setupResult.privateAccess) {
    await applyBotChannelAccess(setupResult.channels?.botUpdateChannel, interaction.guild)
  }

  const privateReady = await applyPrivateSetupAccess(interaction.guild, setupResult)
  if (!privateReady.ok) {
    await deletePostedSetupPanels(panels, 'cleanup-setup-panels-after-access-failure')
    return { ok: false, error: { message: privateReady.message } }
  }
  await notifySetupProgress(options, 'access')

  const previousConfig = ctx.serverConfigs.get(interaction.guild.id)
  await deleteOldSetupPanelMessages(interaction.client, previousConfig, {
    gamePanelMessageId: panels.gamePanelMessage.id,
    playerGrimoirePanelMessageId: panels.playerGrimoirePanelMessage.id
  })
  saveServerConfig(interaction, ctx, setupResult.channels, panels, setupResult)
  await notifySetupProgress(options, 'save')

  return { ok: true, message: createSetupSuccessMessage(setupResult, setupResult.channels) }
}

async function deletePostedSetupPanels(panels, action) {
  for (const message of [panels.gamePanelMessage, panels.playerGrimoirePanelMessage].filter(Boolean)) {
    await queuedMessageDelete(message).catch(err => logSetupRecoverable(action, err, {
      channelId: message.channelId || message.channel?.id,
      guildId: message.guildId || message.guild?.id,
      messageId: message.id
    }))
  }
}

async function finishSetupSupportChannels(interaction, setupResult) {
  const supportReady = setupResult.supportChannelsReady ? await setupResult.supportChannelsReady : null
  if (supportReady) {
    if (!supportReady.ok) return supportReady
    setupResult.cottageCategory = supportReady.cottageCategory
    setupResult.reservedNightVoiceChannels = supportReady.reservedNightVoiceChannels
    setupResult.sharedVoiceChannels = supportReady.sharedVoiceChannels
    return { ok: true }
  }

  if (!setupResult.cottageCategory) {
    const cottagePool = await ensureReservedNightAreaPool(interaction.guild, {
      managedCategories: setupResult.managedCategories,
      managedChannels: setupResult.managedChannels
    })
    if (!cottagePool.ok) return cottagePool
    setupResult.cottageCategory = cottagePool.category
    setupResult.reservedNightVoiceChannels = cottagePool.channels
  }

  return { ok: true }
}

function validateSetupChannels(interaction, channels) {
  if (new Set(channels.map(channel => channel.id)).size !== channels.length) {
    return { ok: false, error: { message: 'Choose different channels so the game panel can stay clean.' } }
  }

  for (const channel of channels) {
    if (!channel?.isTextBased?.()) {
      return { ok: false, error: { message: `${channel ? `<#${channel.id}>` : 'That channel'} must be a text channel.` } }
    }
  }

  const [gameChannel, gameLogChannel, liveChannel, postGameChannel, spectatorChannel, storytellerChannel] = channels
  const missingPermissions = getMissingBotPermissions(
    interaction.guild,
    channels,
    getCleanupChannels(channels, {
      gameChannelId: gameChannel.id,
      gameLogChannelId: gameLogChannel.id,
      liveChannelId: liveChannel.id,
      postGameChannelId: postGameChannel.id,
      spectatorChannelId: spectatorChannel.id,
      storytellerChannelId: storytellerChannel.id
    })
  )

  if (!missingPermissions.length) return { ok: true }
  return { ok: false, error: { message: formatMissingBotPermissions(missingPermissions) } }
}

function saveServerConfig(interaction, ctx, channels, panels, setupResult = {}) {
  const previousConfig = ctx.serverConfigs.get(interaction.guild.id) || {}
  const managedSetup = collectManagedSetupIds(setupResult)
  ctx.serverConfigs.set(interaction.guild.id, {
    botUpdateNoticeUserIds: Array.isArray(previousConfig.botUpdateNoticeUserIds)
      ? previousConfig.botUpdateNoticeUserIds
      : [],
    botUpdateChannelId: channels.botUpdateChannel?.id || previousConfig.botUpdateChannelId || null,
    botcAccessRoleId: setupResult.botcAccessRole?.id || null,
    firstJoinSetupNoticeSentAt: previousConfig.firstJoinSetupNoticeSentAt || null,
    gameChannelId: channels.gameChannel.id,
    gameLogChannelId: channels.gameLogChannel?.id || null,
    gamePanelMessageId: panels.gamePanelMessage.id,
    lastBotUpdateNoticeVersion: previousConfig.lastBotUpdateNoticeVersion || null,
    liveChannelId: channels.liveChannel.id,
    playerGrimoireChannelId: channels.playerGrimoireChannel?.id || null,
    playerGrimoirePanelMessageId: panels.playerGrimoirePanelMessage.id,
    postGameChannelId: channels.postGameChannel.id,
    privateAccess: !!setupResult.privateAccess,
    setupManagedCategoryIds: mergeSetupIds(previousConfig, 'setupManagedCategoryIds', managedSetup.setupManagedCategoryIds),
    setupManagedChannelIds: mergeSetupIds(previousConfig, 'setupManagedChannelIds', managedSetup.setupManagedChannelIds),
    storytellerChannelId: channels.storytellerChannel.id,
    spectatorChannelId: channels.spectatorChannel.id,
    waitingRoomVoiceChannelId: setupResult.sharedVoiceChannels?.waitingRoomVoiceChannel?.id || null
  })
  ctx.saveServerConfigs(ctx.serverConfigs)
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = {
  SETUP_CHANNEL_OPTION_NAMES,
  hasAdministrator,
  preflightUnsafeSetupRoles,
  runSetup
}
