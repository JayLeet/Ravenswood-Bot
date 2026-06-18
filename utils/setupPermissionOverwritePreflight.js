const {
  getCachedGuildRoles
} = require('./discord/cacheValues')

function validateSetupPermissionOverwriteTargets(guild, overwrites = []) {
  const botRole = guild?.members?.me?.roles?.highest
  const rolesById = getRolesById(guild)
  const blockedRoles = []

  for (const overwrite of overwrites) {
    const role = rolesById.get(String(overwrite?.id || ''))
    if (!role || role.id === guild?.id) continue
    if (!canBotWriteRoleOverwrite(role, botRole)) blockedRoles.push(role)
  }

  if (!blockedRoles.length) return { ok: true }

  return {
    ok: false,
    message: createBlockedSetupRoleMessage(blockedRoles)
  }
}

function canBotWriteRoleOverwrite(role, botRole) {
  if (role.editable === false) return false
  if (!botRole || !Number.isFinite(role.position) || !Number.isFinite(botRole.position)) return true
  return role.position < botRole.position
}

function createBlockedSetupRoleMessage(roles) {
  const names = [...new Set(roles.map(role => role.name || `<@&${role.id}>`))]
  return [
    'I cannot create setup channel permission overwrites for one or more BOTC roles.',
    '',
    ...names.map(name => `- ${name}`),
    '',
    'Move my bot role above those roles, then run `/setup` again. Discord only lets me edit channel permissions for roles below my highest role.'
  ].join('\n')
}

function getRolesById(guild) {
  return new Map(getCachedGuildRoles(guild).map(role => [String(role.id), role]))
}

module.exports = {
  validateSetupPermissionOverwriteTargets
}
