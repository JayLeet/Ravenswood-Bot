const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js')

const SETUP_PERMISSION_LABELS = Object.freeze([
  ['Manage Channels', PermissionFlagsBits.ManageChannels],
  ['Manage Roles', PermissionFlagsBits.ManageRoles],
  ['View Channel', PermissionFlagsBits.ViewChannel],
  ['Send Messages', PermissionFlagsBits.SendMessages],
  ['Read Message History', PermissionFlagsBits.ReadMessageHistory],
  ['Use Application Commands', PermissionFlagsBits.UseApplicationCommands],
  ['Manage Messages', PermissionFlagsBits.ManageMessages],
  ['Send Messages in Threads', PermissionFlagsBits.SendMessagesInThreads],
  ['Send TTS Messages', PermissionFlagsBits.SendTTSMessages],
  ['Create Public Threads', PermissionFlagsBits.CreatePublicThreads],
  ['Create Private Threads', PermissionFlagsBits.CreatePrivateThreads],
  ['Attach Files', PermissionFlagsBits.AttachFiles],
  ['Add Reactions', PermissionFlagsBits.AddReactions],
  ['Send Voice Messages', PermissionFlagsBits.SendVoiceMessages],
  ['Use External Emojis', PermissionFlagsBits.UseExternalEmojis],
  ['Use External Stickers', PermissionFlagsBits.UseExternalStickers],
  ['Use External Apps', PermissionFlagsBits.UseExternalApps],
  ['Mention Everyone', PermissionFlagsBits.MentionEveryone],
  ['Manage Webhooks', PermissionFlagsBits.ManageWebhooks],
  ['Connect', PermissionFlagsBits.Connect],
  ['Speak', PermissionFlagsBits.Speak],
  ['Stream', PermissionFlagsBits.Stream],
  ['Move Members', PermissionFlagsBits.MoveMembers],
  ['Mute Members', PermissionFlagsBits.MuteMembers]
])

function createSetupPermissionDiagnostics({
  guild,
  target = null,
  overwrites = [],
  requiredChannelPermissions = []
} = {}) {
  const diagnostics = []
  const botMember = guild?.members?.me
  if (!botMember) return ['I could not inspect my bot member permissions in this server.']
  if (botMember.permissions?.has?.(PermissionFlagsBits.Administrator)) return []

  for (const permission of requiredChannelPermissions) {
    const label = getPermissionLabel(permission)
    if (!botMember.permissions?.has?.(permission)) {
      diagnostics.push(`Missing server permission on my bot role: ${label}.`)
      continue
    }

    if (target && !target.permissionsFor?.(botMember)?.has?.(permission)) {
      diagnostics.push(`Missing channel/category permission in ${formatChannelLabel(target)}: ${label}.`)
    }
  }

  const blockedRoles = getBlockedOverwriteRoles(guild, overwrites)
  if (blockedRoles.length) {
    diagnostics.push(`Role hierarchy blocked: move my bot role above ${formatRoleList(blockedRoles)}.`)
  }

  const unmanageableOverwritePermissions = getUnmanageableOverwritePermissions(guild, target, overwrites)
  if (unmanageableOverwritePermissions.length) {
    diagnostics.push(`Permission overwrite payload includes permissions I cannot manage here: ${unmanageableOverwritePermissions.join(', ')}.`)
  }

  return [...new Set(diagnostics)]
}

function getBlockedOverwriteRoles(guild, overwrites = []) {
  const botRole = guild?.members?.me?.roles?.highest
  const rolesById = getRolesById(guild)
  const blocked = []

  for (const overwrite of overwrites) {
    if (!isRoleOverwrite(guild, overwrite)) continue
    const role = rolesById.get(String(overwrite.id))
    if (!role) continue
    if (role.editable === false || !isRoleBelowBot(role, botRole)) blocked.push(role)
  }

  return blocked
}

function isRoleOverwrite(guild, overwrite) {
  if (!overwrite?.id || String(overwrite.id) === String(guild?.id)) return false
  if (overwrite.type === 0 || overwrite.type === '0' || overwrite.type === 'Role') return true
  return getRolesById(guild).has(String(overwrite.id))
}

function isRoleBelowBot(role, botRole) {
  if (!botRole || !Number.isFinite(role.position) || !Number.isFinite(botRole.position)) return true
  return role.position < botRole.position
}

function getRolesById(guild) {
  return new Map(getCachedRoles(guild).map(role => [String(role.id), role]))
}

function getCachedRoles(guild) {
  const cache = guild?.roles?.cache
  if (typeof cache?.values === 'function') return [...cache.values()]
  if (Array.isArray(cache)) return cache
  return []
}

function getUnmanageableOverwritePermissions(guild, target, overwrites = []) {
  if (!overwrites.length) return []
  const botMember = guild?.members?.me
  if (!botMember) return []

  return [...new Set(overwrites
    .flatMap(overwrite => getPermissionBitsFromOverwrite(overwrite))
    .filter(permission => !botHasPermission(botMember, target, permission))
    .map(getPermissionLabel))]
}

function getPermissionBitsFromOverwrite(overwrite) {
  const bits = []
  for (const [, permission] of SETUP_PERMISSION_LABELS) {
    if (!permission) continue
    if (permissionSetIncludes(overwrite?.allow, permission) ||
        permissionSetIncludes(overwrite?.deny, permission)) {
      bits.push(permission)
    }
  }
  return bits
}

function botHasPermission(botMember, target, permission) {
  const targetPermissions = target?.permissionsFor?.(botMember)
  if (targetPermissions?.has) return targetPermissions.has(permission)
  return Boolean(botMember.permissions?.has?.(permission))
}

function permissionSetIncludes(value, flag) {
  if (!value) return false
  if (typeof value.has === 'function') return value.has(flag)
  if (typeof value.includes === 'function') return value.includes(flag)
  if (Array.isArray(value)) return value.includes(flag)
  const bitfield = value.bitfield ?? value
  try {
    return (BigInt(bitfield) & BigInt(flag)) === BigInt(flag)
  } catch {
    return false
  }
}

function formatChannelLabel(channel) {
  if (!channel?.id) return 'the target channel'
  if (channel.type === ChannelType.GuildCategory) {
    return `${channel.name || 'the category'} (${channel.id})`
  }
  return `<#${channel.id}>`
}

function formatRoleList(roles) {
  return roles
    .map(role => role.name || `<@&${role.id}>`)
    .filter(Boolean)
    .join(', ')
}

function getPermissionLabel(permission) {
  return SETUP_PERMISSION_LABELS.find(([, bit]) => bit === permission)?.[0] || String(permission)
}

function formatSetupPermissionDiagnostics(diagnostics = []) {
  if (!diagnostics.length) {
    return 'I could not read a more specific missing permission from Discord cache. Check Manage Channels, Manage Roles, and bot-role order.'
  }
  return diagnostics.map(item => `- ${item}`).join('\n')
}

module.exports = {
  createSetupPermissionDiagnostics,
  formatSetupPermissionDiagnostics
}
