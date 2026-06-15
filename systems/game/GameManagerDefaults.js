
function createGameManagerRoleDefaults() {
  const roleNames = {
    player: '👤 Player',
    spectator: '👁️ Spectator',
    storyteller: '📖 Storyteller'
  }
  const roleColors = {}


  return { roleNames, roleColors }
}

function createGameManagerNicknamePrefixes() {
  return {
    player: '👤 ',
    deadWithVote: '💀 ',
    deadVoteSpent: '💀❌ ',
    spectator: '👁️ ',
    grimoireSpectator: '👁️🔍 ',
    storyteller: '📖 '
  }
}

module.exports = {
  createGameManagerNicknamePrefixes,
  createGameManagerRoleDefaults
}
