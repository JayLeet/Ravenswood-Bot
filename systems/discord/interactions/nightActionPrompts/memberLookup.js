const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const { createFakeMember } = require('../fakeMembers')

async function getNightActionMember({
  gameLifecycle,
  game,
  guild,
  logger,
  playerId,
  view
}) {
  if (gameLifecycle.isFakePlayer(game, playerId)) return createFakeMember(playerId, view)
  return fetchGuildMemberWithRecoverableFallback({
    action: 'fetch-night-action-member',
    guild,
    logger,
    userId: playerId
  })
}

module.exports = {
  getNightActionMember
}
