const {
  ensureGrimoireSpectatorRole
} = require('../../../../utils/grimoireSpectatorRole')

async function getGameVoiceRoleIds(guild, gameManager) {
  await gameManager.ensureGameRoles(guild)
  const grimoireSpectator = await ensureGrimoireSpectatorRole(guild)

  return {
    player: getGameRoleId(guild, gameManager, 'player'),
    spectator: getGameRoleId(guild, gameManager, 'spectator'),
    grimoireSpectator: grimoireSpectator?.id || null,
    storyteller: getGameRoleId(guild, gameManager, 'storyteller')
  }
}

function getGameRoleId(guild, gameManager, type) {
  const roleName = gameManager.roleNames[type]
  return guild.roles.cache.find(role => role.name === roleName)?.id || null
}

module.exports = {
  getGameVoiceRoleIds
}
