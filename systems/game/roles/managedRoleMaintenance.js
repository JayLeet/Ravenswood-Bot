const {
  PermissionsBitField
} = require('discord.js')
const {
  ensureGrimoireSpectatorRole
} = require('../../../utils/grimoireSpectatorRole')
const {
  queuedRoleColorEdit,
  queuedRolePermissionsEdit,
  queuedRolePositionSet
} = require('../../../utils/discord/memberActions')
const {
  createBotLogger
} = require('../../../utils/logger')

const MANAGED_ROLE_PERMISSIONS = new PermissionsBitField(0n)
const log = createBotLogger({ subsystem: 'ManagedRoleMaintenance' })

async function refreshManagedGameRole(role, type, color) {
  await queuedRoleColorEdit(role, color, `BOTC ${type} role color update`).catch(err => {
    logRoleMaintenanceFailure('refresh-managed-role-color', err, role, { type })
    return false
  })
  await queuedRolePermissionsEdit(role, MANAGED_ROLE_PERMISSIONS, `BOTC ${type} role permissions reset`).catch(err => {
    logRoleMaintenanceFailure('refresh-managed-role-permissions', err, role, { type })
    return false
  })
}

async function prepareManagedGameRole(guild, role, type, color) {
  await refreshManagedGameRole(role, type, color)
  const placement = await keepManagedRolesBelowBot(guild, [role])
  return placement.ok ? role : null
}

async function ensureManagedGrimoireSpectatorRole(guild) {
  const role = await ensureGrimoireSpectatorRole(guild)
  if (!role) return null

  await queuedRolePermissionsEdit(role, MANAGED_ROLE_PERMISSIONS, 'BOTC grimoire spectator role permissions reset').catch(err => {
    logRoleMaintenanceFailure('refresh-grimoire-spectator-role-permissions', err, role)
    return false
  })
  const placement = await keepManagedRolesBelowBot(guild, [role])
  return placement.ok ? role : null
}

async function keepManagedRolesBelowBot(guild, roles) {
  const botRole = guild.members.me?.roles?.highest

  if (!botRole) return { ok: false, message: 'I could not inspect my own role position.' }

  for (const role of roles) {
    if (role.position < botRole.position) continue

    if (!role.editable) {
      return {
        ok: false,
        message: `Move my bot role above ${role.name}, then run /setup again. Discord only lets me manage roles below my highest role.`
      }
    }

    const moved = await queuedRolePositionSet(role, Math.max(botRole.position - 1, 1)).catch(err => {
      logRoleMaintenanceFailure('move-managed-role-below-bot', err, role, {
        botRoleId: botRole.id
      })
      return false
    })
    if (!moved) return { ok: false, message: `I could not move ${role.name} below my bot role.` }
  }

  return { ok: true }
}

function logRoleMaintenanceFailure(action, err, role, context = {}) {
  log.recoverable(action, err, {
    guildId: role?.guild?.id,
    roleId: role?.id,
    roleName: role?.name,
    ...context
  })
}

module.exports = {
  MANAGED_ROLE_PERMISSIONS,
  ensureManagedGrimoireSpectatorRole,
  keepManagedRolesBelowBot,
  prepareManagedGameRole,
  refreshManagedGameRole
}
