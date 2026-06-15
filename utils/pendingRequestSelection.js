function getSelectedPendingRequest(interaction, gameLifecycle, optionName = 'player') {
  const user = interaction.options.getUser(optionName)
  if (!user) {
    return { ok: false, error: { message: 'Choose a player with a pending request.' } }
  }

  const pending = gameLifecycle.getPendingRequests(interaction.guild.id)
  if (!pending.ok) return pending

  const request = pending.requests.find(candidate => candidate.userId === user.id)
  if (!request) {
    return {
      ok: false,
      error: { message: `<@${user.id}> does not have a pending request.` }
    }
  }

  return { ok: true, request, user }
}

module.exports = {
  getSelectedPendingRequest
}
