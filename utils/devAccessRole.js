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
  AUTO_SETUP_CATEGORY_NAME
} = require('./botcChannelNames')
const {
  createBotLogger
} = require('./logger')

const DEV_ROLE_NAME = '🤖 BOTC Bot Dev'
const MANAGED_CATEGORY_NAMES = Object.freeze([
  AUTO_SETUP_CATEGORY_NAME,
  'Ravenswood Bluff Cottages'
])
const DEV_ROLE_PERMISSIONS = 0n
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

async function toggleDevAccess(guild, member) {
  if (!guild || !member) {
    return { ok: false, message: 'I could not find this server member.' }
  }

  const role = await ensureDevRole(guild)
  if (!role) {
    return { ok: false, message: `I could not create or find the ${DEV_ROLE_NAME} role.` }
  }

  if (hasRole(member, role)) {
    await queuedMemberRoleRemove(member, role)
    return { ok: true, enabled: false, role, channelsUpdated: 0, channelsSkipped: 0 }
  }

  const access = await applyDevRoleChannelAccess(guild, role)
  await queuedMemberRoleAdd(member, role)

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

async function applyDevRoleChannelAccess(guild, role) {
  await guild.channels?.fetch?.().catch(err => log.recoverable('fetch-dev-role-channels', err, { guildId: guild.id }))
  let channelsUpdated = 0
  let channelsSkipped = 0

  for (const channel of getGuildChannels(guild)) {
    if (!isBotcManagedChannel(channel, guild)) continue

    if (!canEditChannelOverwrites(guild, channel)) {
      channelsSkipped += 1
      continue
    }

    const updated = await editPermissionOverwrite(
      channel,
      role.id,
      DEV_CHANNEL_PERMISSION_PATCH,
      { reason: 'BOTC Bot developer channel access', type: OverwriteType.Role }
    ).catch(err => {
      channelsSkipped += 1
      log.recoverable('apply-dev-role-channel-access', err, {
        channelId: channel.id,
        guildId: guild.id,
        roleId: role.id
      })
      return false
    })

    if (updated) channelsUpdated += 1
  }

  return { channelsUpdated, channelsSkipped }
}

function isBotcManagedChannel(channel, guild) {
  if (!channel) return false
  if (MANAGED_CATEGORY_NAMES.includes(channel.name)) return true

  const parentId = channel.parentId || channel.parent?.id
  if (!parentId) return false
  const parent = getGuildChannels(guild).find(candidate => candidate?.id === parentId)
  return MANAGED_CATEGORY_NAMES.includes(parent?.name)
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
  const cache = guild?.roles?.cache
  if (!cache) return null
  if (typeof cache.find === 'function') return cache.find(role => role?.name === roleName) || null
  if (typeof cache.values === 'function') return [...cache.values()].find(role => role?.name === roleName) || null
  if (Array.isArray(cache)) return cache.find(role => role?.name === roleName) || null
  return Object.values(cache).find(role => role?.name === roleName) || null
}

function hasRole(member, role) {
  return Boolean(member?.roles?.cache?.has?.(role?.id))
}

function getGuildChannels(guild) {
  const cache = guild?.channels?.cache
  if (!cache) return []
  if (typeof cache.values === 'function') return [...cache.values()]
  if (Array.isArray(cache)) return cache
  return Object.values(cache)
}

module.exports = {
  DEV_CHANNEL_PERMISSION_PATCH,
  DEV_ROLE_NAME,
  DEV_ROLE_PERMISSIONS,
  MANAGED_CATEGORY_NAMES,
  applyDevRoleChannelAccess,
  toggleDevAccess
}
