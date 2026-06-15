const { createFakeMember } = require('./fakeMembers')

function resolveTestPlayerInteractionMember({
  gameLifecycle,
  game,
  interaction,
  playerId,
  view = null
}) {
  if (!canSimulateTestPlayerInteraction({ gameLifecycle, game, interaction, playerId })) {
    return interaction.member
  }

  return createFakeMember(playerId, view)
}

function canSimulateTestPlayerInteraction({
  gameLifecycle,
  game,
  interaction,
  playerId
}) {
  if (!game?.testMode || !playerId) return false

  const clickerId = getInteractionUserId(interaction)
  if (!clickerId || !gameLifecycle?.isStoryteller?.(game, clickerId)) return false

  return gameLifecycle?.isFakePlayer?.(game, playerId) === true
}

function getInteractionUserId(interaction) {
  return interaction?.member?.id || interaction?.user?.id || interaction?.member?.user?.id || null
}

module.exports = {
  resolveTestPlayerInteractionMember
}
