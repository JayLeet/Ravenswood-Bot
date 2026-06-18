const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  editPermissionOverwrite
} = require('./discord/permissionOverwriteActions')
const {
  queuedMemberRoleAdd,
  queuedMemberRoleRemove,
  queuedRolePermissionsEdit,
  queuedRolePositionSet
} = require('./discord/memberActions')
const {
  queuedGuildRoleCreate
} = require('./discord/roleActions')
const {
  findCacheValue,
  getCachedGuildChannels
} = require('./discord/cacheValues')
const {
  createBotLogger
} = require('./logger')

const DEV_ROLE_NAME = '🤖 BOTC Bot Dev'
const DEV_ROLE_PERMISSIONS = 0n
const SETUP_CHANNEL_ID_FIELDS = Object.freeze([
  'botUpdateChannelId',
  'gameChannelId',
  'gameLogChannelId',
  'liveChannelId',
  'playerGrimoireChannelId',
  'postGameChannelId',
  'spectatorChannelId',
  'storytellerChannelId',
  'waitingRoomVoiceChannelId'
])
const DEV_CHANNEL_PERMISSION_PATCH = Object.freeze({
  ViewChannel: true,
  ReadMessageHistory: true,
  UseApplicationCommands: true,
  SendMessages: true,
  SendMessagesInThreads: true,
  Connect: true,
  Speak: true,
  Stream: true,
  UseVAD: true
})
const log = createBotLogger({ subsystem: 'DevAccessRole' })

async function toggleDevAccess(guild, member, options = {}) {
  if (!guild || !member) {
    return { ok: false, message: 'I could not find this server member.' }
  }

  const role = await ensureDevRole(guild)
  if (!role) {
    return { ok: false, message: `I could not create or find the ${DEV_ROLE_NAME} role.` }
  }

  if (hasRole(member, role)) {
    await queuedMemberRoleRemove(member, role)
    log.info('disable-dev-access', 'Removed developer access role from owner.', {
      guildId: guild.id,
      memberId: member.id,
      roleId: role.id
    })
    return { ok: true, enabled: false, role, channelsUpdated: 0, channelsSkipped: 0 }
  }

  const access = await applyDevRoleChannelAccess(guild, role, options.serverConfig || {})
  await queuedMemberRoleAdd(member, role)
  log.info('enable-dev-access', 'Applied developer access role to setup-managed channels.', {
    channelsSkipped: access.channelsSkipped,
    channelsUpdated: access.channelsUpdated,
    guildId: guild.id,
    memberId: member.id,
    roleId: role.id
  })

  return {
    ok: true,
    enabled: true,
    role,
    ...access
  }
}

async function ensureDevRole(guild) {
  await guild.roles?.fetch?.().catch(err => log.recoverable('fetch-dev-role', err, { guildId: guild.id }))
  const existing = findRoleByName(guild, DEV_ROLE_NAME)
  const role = existing || await queuedGuildRoleCreate(guild, {
    name: DEV_ROLE_NAME,
    permissions: DEV_ROLE_PERMISSIONS,
    reason: 'BOTC Bot developer channel access role'
  }).catch(err => {
    log.recoverable('create-dev-role', err, { guildId: guild.id })
    return null
  })

  if (!role) return null
  await queuedRolePermissionsEdit(role, DEV_ROLE_PERMISSIONS, 'BOTC Bot developer role keeps guild permissions empty')
    .catch(err => log.recoverable('clear-dev-role-permissions', err, { guildId: guild.id, roleId: role.id }))
  await ensureRoleBelowBot(guild, role)
  return role
}

async function ensureRoleBelowBot(guild, role) {
  const botPosition = guild?.members?.me?.roles?.highest?.position
  if (!Number.isFinite(botPosition)) return false
  if (!Number.isFinite(role?.position) || role.position < botPosition) return false
  return queuedRolePositionSet(role, Math.max(1, botPosition - 1))
    .catch(err => log.recoverable('position-dev-role-below-bot', err, {
      guildId: guild.id,
      roleId: role.id
    }))
}

async function applyDevRoleChannelAccess(guild, role, serverConfig = {}) {
  await guild.channels?.fetch?.().catch(err => log.recoverable('fetch-dev-role-channels', err, { guildId: guild.id }))
  let channelsUpdated = 0
  let channelsSkipped = 0
  const updatedChannels = []
  const skippedChannels = []
  const managedIds = createDevAccessTargetIds(serverConfig)

  for (const channel of getGuildChannels(guild)) {
    if (!isSetupManagedChannel(channel, managedIds)) continue

    if (!canEditChannelOverwrites(guild, channel)) {
      channelsSkipped += 1
      skippedChannels.push(formatChannelLabel(channel))
      continue
    }

    const updated = await editPermissionOverwrite(
      channel,
      role.id,
      DEV_CHANNEL_PERMISSION_PATCH,
      { reason: 'BOTC Bot developer channel access', type: OverwriteType.Role }
    ).catch(err => {
      channelsSkipped += 1
      skippedChannels.push(formatChannelLabel(channel))
      log.recoverable('apply-dev-role-channel-access', err, {
        channelId: channel.id,
        guildId: guild.id,
        roleId: role.id
      })
      return false
    })

    if (updated) {
      channelsUpdated += 1
      updatedChannels.push(formatChannelLabel(channel))
    }
  }

  return { channelsSkipped, channelsUpdated, skippedChannels, updatedChannels }
}

function createDevAccessTargetIds(serverConfig = {}) {
  return new Set([
    ...toIdArray(serverConfig.setupManagedCategoryIds),
    ...toIdArray(serverConfig.setupManagedChannelIds),
    ...toIdArray(serverConfig.setupBotCreatedCategoryIds),
    ...toIdArray(serverConfig.setupBotCreatedChannelIds),
    ...SETUP_CHANNEL_ID_FIELDS.map(key => serverConfig[key])
  ].filter(Boolean).map(String))
}

function isSetupManagedChannel(channel, managedIds) {
  return Boolean(channel?.id && managedIds.has(String(channel.id)))
}

function canEditChannelOverwrites(guild, channel) {
  if (!channel?.permissionOverwrites?.edit) return false
  if (typeof channel.permissionsFor !== 'function') return true

  const botMember = guild?.members?.me
  const permissions = botMember ? channel.permissionsFor(botMember) : null
  if (!permissions?.has) return false
  if (permissions.has(PermissionFlagsBits.Administrator)) return true
  return permissions.has(PermissionFlagsBits.ViewChannel) &&
    permissions.has(PermissionFlagsBits.ManageRoles)
}

function findRoleByName(guild, roleName) {
  return findCacheValue(guild?.roles?.cache, role => role?.name === roleName)
}

function hasRole(member, role) {
  return Boolean(member?.roles?.cache?.has?.(role?.id))
}

function getGuildChannels(guild) {
  return getCachedGuildChannels(guild)
}

function formatChannelLabel(channel) {
  return channel?.id ? `<#${channel.id}>` : String(channel?.name || 'Unknown channel')
}

function toIdArray(value) {
  return Array.isArray(value) ? value : []
}

module.exports = {
  DEV_CHANNEL_PERMISSION_PATCH,
  DEV_ROLE_NAME,
  DEV_ROLE_PERMISSIONS,
  applyDevRoleChannelAccess,
  createDevAccessTargetIds,
  toggleDevAccess
}
