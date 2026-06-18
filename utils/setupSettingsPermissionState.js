const {
  PermissionFlagsBits
} = require('discord.js')
const {
  hasPermissionBit,
  normalizePermissionBitfield
} = require('./discord/permissionBits')
const {
  getCachedPermissionOverwrite
} = require('./discord/permissionOverwriteCache')

function getSetupPermissionState(channel, role, permissionName) {
  const bit = PermissionFlagsBits[permissionName]
  if (bit === undefined) return { enabled: false, source: 'unknown' }

  const overwrite = getCachedPermissionOverwrite(channel, role?.id)
  if (overwrite) {
    const allow = normalizePermissionBitfield(overwrite.allow)
    const deny = normalizePermissionBitfield(overwrite.deny)
    const permissionBit = normalizePermissionBitfield(bit)
    if (hasPermissionBit(deny, permissionBit)) return { enabled: false, source: 'overwrite-deny' }
    if (hasPermissionBit(allow, permissionBit)) return { enabled: true, source: 'overwrite-allow' }
  }

  const effective = getEffectivePermissionState(channel, role, bit)
  if (typeof effective === 'boolean') return { enabled: effective, source: 'effective' }

  return { enabled: false, source: overwrite ? 'unset-overwrite' : 'missing-overwrite' }
}

function isPermissionEnabled(channel, role, permissionName) {
  return getSetupPermissionState(channel, role, permissionName).enabled
}

function getEffectivePermissionState(channel, role, bit) {
  const resolved = getChannelPermissions(channel, role)
  if (resolved && typeof resolved.has === 'function') return resolved.has(bit)
  const rolePermissions = role?.permissions
  if (rolePermissions && typeof rolePermissions.has === 'function') return rolePermissions.has(bit)
  return null
}

function getChannelPermissions(channel, role) {
  if (typeof channel?.permissionsFor !== 'function' || !role) return null
  return channel.permissionsFor(role) || channel.permissionsFor(role.id) || null
}

module.exports = {
  getSetupPermissionState,
  isPermissionEnabled
}
