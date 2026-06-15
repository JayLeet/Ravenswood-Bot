const {
  ensureManagedGrimoireSpectatorRole
} = require('./managedRoleMaintenance')

async function ensureGameRolesForGuild(manager, guild) {
  const roles = []

  for (const type of Object.keys(manager.roleNames)) {
    if (shouldSkipRoleForGuild(type, guild)) continue

    const role = await manager.getOrCreateGameRoleForGuild(guild, type)
    if (!role) {
      return { ok: false, message: `I could not create or find the ${manager.roleNames[type]} role.` }
    }
    roles.push(role)
  }

  const grimoireRole = await ensureManagedGrimoireSpectatorRole(guild)
  if (!grimoireRole) {
    return { ok: false, message: 'I could not create or find the grimoire spectator role.' }
  }
  roles.push(grimoireRole)

  return manager.keepGameRolesBelowBot(guild, roles)
}

function shouldSkipRoleForGuild() {
  return false
}

module.exports = {
  ensureGameRolesForGuild,
  shouldSkipRoleForGuild
}
