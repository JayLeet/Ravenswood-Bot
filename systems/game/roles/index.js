const {
  DEFAULT_SCRIPT_ID,
  createRoleCategories,
  getRoleIds
} = require('../scripts')

/**
 * @param {import('../../../types').ScriptId} [scriptId]
 * @returns {import('../../../types').RoleCategories}
 */
function createDefaultRoleCategories(scriptId = DEFAULT_SCRIPT_ID) {
  return createRoleCategories(scriptId)
}

/**
 * @param {import('../../../types').GameRecord} game
 * @returns {void}
 */
function removeRolesOutsideScript(game) {
  const roleIds = new Set(getRoleIds(game.scriptId))

  for (const [userId, roleId] of Object.entries(game.roles || {})) {
    if (!roleIds.has(roleId)) delete game.roles[userId]
  }
}

/**
 * @param {import('../../../types').ScriptId} scriptId
 * @returns {Set<import('../../../types').RoleId>}
 */
function getScriptRoleIds(scriptId) {
  return new Set(getRoleIds(scriptId))
}

module.exports = {
  createDefaultRoleCategories,
  getScriptRoleIds,
  removeRolesOutsideScript
}
