const { PermissionFlagsBits } = require('discord.js')

const GLOBAL_COMMAND_ACCESS_USER_IDS = Object.freeze([
  '242230000747544576'
])
const GLOBAL_COMMAND_ACCESS_USER_ID_SET = new Set(GLOBAL_COMMAND_ACCESS_USER_IDS)

function getCommandAccessUserId(target) {
  if (!target) return null
  if (typeof target === 'string') return target
  return target.user?.id ||
    target.member?.user?.id ||
    target.member?.id ||
    target.id ||
    null
}

function hasGlobalCommandAccess(target) {
  const userId = getCommandAccessUserId(target)
  return GLOBAL_COMMAND_ACCESS_USER_ID_SET.has(String(userId || ''))
}

function hasPermission(target, permission) {
  return Boolean(
    target?.memberPermissions?.has?.(permission) ||
    target?.member?.permissions?.has?.(permission) ||
    target?.permissions?.has?.(permission)
  )
}

function hasAdministratorPermission(target) {
  return hasPermission(target, PermissionFlagsBits.Administrator)
}

function hasManageGuildPermission(target) {
  return hasPermission(target, PermissionFlagsBits.ManageGuild)
}

function hasAdministratorOrGlobalCommandAccess(target) {
  return hasGlobalCommandAccess(target) || hasAdministratorPermission(target)
}

function hasManageGuildOrGlobalCommandAccess(target) {
  return hasGlobalCommandAccess(target) || hasManageGuildPermission(target)
}

function shouldOmitDefaultMemberPermissions(slashCommand) {
  return Boolean(slashCommand?.default_member_permissions)
}

module.exports = {
  GLOBAL_COMMAND_ACCESS_USER_IDS,
  getCommandAccessUserId,
  hasAdministratorOrGlobalCommandAccess,
  hasAdministratorPermission,
  hasGlobalCommandAccess,
  hasManageGuildOrGlobalCommandAccess,
  hasManageGuildPermission,
  hasPermission,
  shouldOmitDefaultMemberPermissions
}
