const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../utils/logger')

function createMemberRecovery({ gameManager }) {
  const log = createBotLogger({ subsystem: 'MemberRecovery' })

  async function restoreGameMembers(guild, game) {
    let restored = 0

    for (const [userId, user] of Object.entries(game.users || {})) {
      if (user.fake) continue

      const member = await fetchGuildMemberWithRecoverableFallback({
        action: 'fetch-recovery-member',
        guild,
        logger: log,
        userId
      })
      if (!member) continue

      let roleAdded = false
      if (user.role === 'player') roleAdded = await gameManager.addPlayerRole(member)
      if (user.role === 'spectator') roleAdded = await gameManager.addSpectatorRole(member)
      if (user.role === 'storyteller') roleAdded = await gameManager.addStorytellerRole(member)

      await gameManager.setGameNickname(member, game, userId)
      if (roleAdded) restored += 1
    }

    return restored
  }

  return {
    restoreGameMembers
  }
}

module.exports = {
  createMemberRecovery
}
