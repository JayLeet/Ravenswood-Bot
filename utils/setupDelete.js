const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  queuedChannelDelete
} = require('./discord/channelActions')
const {
  createSetupDeletePlan,
  hasRemainingChildren
} = require('./setupDeletePlan')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('./commandAccess')
const {
  logSetupRecoverable
} = require('./setupLogging')

const SETUP_DELETE_CUSTOM_ID = 'botc:setup-delete'
const SETUP_CONFIG_CHANNEL_KEYS = Object.freeze([
  'botUpdateChannelId',
  'gameChannelId',
  'gameLogChannelId',
  'gamePanelMessageId',
  'liveChannelId',
  'playerGrimoireChannelId',
  'playerGrimoirePanelMessageId',
  'postGameChannelId',
  'spectatorChannelId',
  'storytellerChannelId',
  'storytellerDashboardMessageId',
  'storytellerDashboardStatusMessageId',
  'storytellerNightOrderGuidanceMessageId',
  'storytellerNominationDashboardMessageId',
  'waitingRoomVoiceChannelId'
])
function createSetupDeleteButton() {
  return new ButtonBuilder()
    .setCustomId(SETUP_DELETE_CUSTOM_ID)
    .setEmoji('🧹')
    .setLabel('Delete BOTC setup')
    .setStyle(ButtonStyle.Danger)
}

function createSetupDeleteRow() {
  return new ActionRowBuilder().addComponents(createSetupDeleteButton())
}

function isSetupDeleteInteraction(customId) {
  return String(customId || '') === SETUP_DELETE_CUSTOM_ID
}

async function executeSetupDelete(interaction, context = {}) {
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
    return {
      ok: false,
      error: { message: 'Only a server administrator or bot owner access user can delete the BOTC setup.' }
    }
  }

  if (hasActiveGame(interaction, context.gameLifecycle)) {
    return {
      ok: false,
      error: { message: 'End the active game before deleting the BOTC setup channels.' }
    }
  }

  const guildId = interaction.guild?.id
  const serverConfig = context.serverConfigs?.get?.(guildId) || {}
  const result = await deleteBotManagedSetup(interaction.guild, serverConfig)
  if (result.failed) {
    return {
      ok: false,
      error: { message: createSetupDeleteFailureMessage(result) }
    }
  }

  savePostDeleteConfig(guildId, serverConfig, context)
  return {
    ok: true,
    embeds: [createSetupDeleteResultEmbed(result)]
  }
}

async function deleteBotManagedSetup(guild, serverConfig = {}) {
  const refreshed = await refreshGuildChannels(guild)
  if (!refreshed) return createSetupDeleteResult({ failed: 1, refreshFailed: true })

  const plan = createSetupDeletePlan(guild, serverConfig)
  const result = createSetupDeleteResult({
    plannedChannels: plan.channels.length,
    plannedCategories: plan.categories.length
  })
  const deletedChannelIds = new Set()

  for (const channel of plan.channels) {
    const deleted = await deleteChannel(channel, 'BOTC setup delete')
    if (deleted) {
      result.deletedChannels += 1
      deletedChannelIds.add(String(channel.id))
    } else {
      result.failed += 1
    }
  }

  for (const category of plan.categories) {
    if (hasRemainingChildren(guild, category, deletedChannelIds)) {
      result.preservedCategories += 1
      continue
    }

    const deleted = await deleteChannel(category, 'BOTC setup delete')
    if (deleted) result.deletedCategories += 1
    else result.failed += 1
  }

  return result
}

function savePostDeleteConfig(guildId, previousConfig, context = {}) {
  if (!guildId || !context.serverConfigs?.set || !context.saveServerConfigs) return
  const next = createPostDeleteServerConfig(previousConfig)
  context.serverConfigs.set(guildId, next)
  context.saveServerConfigs(context.serverConfigs)
}

function createPostDeleteServerConfig(config = {}) {
  const next = { ...config }
  for (const key of SETUP_CONFIG_CHANNEL_KEYS) delete next[key]
  delete next.setupManagedCategoryIds
  delete next.setupManagedChannelIds
  next.privateAccess = false
  return next
}

function collectManagedSetupIds(setupResult = {}) {
  return {
    setupManagedCategoryIds: uniqueIds(toObjectValues(setupResult.managedCategories)),
    setupManagedChannelIds: uniqueIds(toObjectValues(setupResult.managedChannels))
  }
}

function createSetupDeleteResultEmbed(result) {
  return new EmbedBuilder()
    .setTitle('BOTC setup deleted')
    .setDescription(createSetupDeleteSuccessMessage(result))
    .setColor(0x2ecc71)
    .setTimestamp()
}

function createSetupDeleteSuccessMessage(result) {
  const lines = [
    `Deleted ${result.deletedChannels} channel(s) and ${result.deletedCategories} category/categories.`
  ]
  if (result.preservedCategories) {
    lines.push(`Left ${result.preservedCategories} category/categories in place because they still contain non-BOTC channels.`)
  }
  if (!result.deletedChannels && !result.deletedCategories) {
    lines.push('Nothing BOTC-managed was found to delete.')
  }
  lines.push('User-created channels are left alone.')
  return lines.join('\n')
}

function createSetupDeleteFailureMessage(result) {
  if (result.refreshFailed) {
    return 'I could not refresh the Discord channel list before deleting setup channels. Try again in a moment.'
  }
  return [
    `I could not delete every BOTC setup item. Deleted ${result.deletedChannels} channel(s) and ${result.deletedCategories} category/categories before stopping.`,
    'Check Manage Channels and the bot role position, then run `/delete` again.'
  ].join('\n')
}

function createSetupDeleteResult(overrides = {}) {
  return {
    deletedCategories: 0,
    deletedChannels: 0,
    failed: 0,
    plannedCategories: 0,
    plannedChannels: 0,
    preservedCategories: 0,
    refreshFailed: false,
    ...overrides
  }
}

function hasActiveGame(interaction, gameLifecycle) {
  const game = gameLifecycle?.get?.(interaction.guild?.id)
  return game && game.state !== 'ended'
}

async function refreshGuildChannels(guild) {
  if (!guild?.channels?.fetch) return false
  return guild.channels.fetch()
    .then(() => true)
    .catch(err => logSetupRecoverable('fetch-setup-delete-channels', err, { guildId: guild?.id }, false))
}

function deleteChannel(channel, reason) {
  if (typeof channel?.delete !== 'function') return Promise.resolve(false)
  return queuedChannelDelete(channel, reason)
    .then(() => true)
    .catch(err => logSetupRecoverable('delete-setup-managed-channel', err, {
      channelId: channel?.id,
      guildId: channel?.guildId || channel?.guild?.id
    }, false))
}

function uniqueIds(items) {
  return [...new Set(items
    .map(item => item?.id || item)
    .filter(Boolean)
    .map(String))]
}

function toObjectValues(value) {
  return value && typeof value === 'object' ? Object.values(value) : []
}

module.exports = {
  SETUP_DELETE_CUSTOM_ID,
  collectManagedSetupIds,
  createPostDeleteServerConfig,
  createSetupDeleteButton,
  createSetupDeleteResultEmbed,
  createSetupDeleteRow,
  deleteBotManagedSetup,
  executeSetupDelete,
  isSetupDeleteInteraction
}
