const {
  getGameRoles
} = require('../../../../utils/setupTextChannelPermissions')

function createNightAreaRoleIds(guild, gameManager) {
  const roles = gameManager ? getGameRoles(guild, gameManager) : {}
  return {
    grimoireSpectator: roles.grimoireSpectator?.id || null,
    player: roles.player?.id || null,
    spectator: roles.spectator?.id || null,
    storyteller: roles.storyteller?.id || null
  }
}

module.exports = {
  createNightAreaRoleIds
}
