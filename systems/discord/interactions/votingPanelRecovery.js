async function recoverVotingPanels({
  discordClient,
  guildId,
  postOrUpdateVotingPanel,
  view
}) {
  let recovered = 0
  const activeStatuses = new Set(['pending_second', 'seconded', 'voting'])

  for (const nomination of view.engine.nominations || []) {
    const isActive = activeStatuses.has(nomination.status)
    const shouldCloseStalePanel = nomination.status === 'resolved' && nomination.messageId
    if (!isActive && !shouldCloseStalePanel) continue

    const message = await postOrUpdateVotingPanel(discordClient, guildId, nomination, view)
    if (message) recovered += 1
  }

  return recovered
}

module.exports = {
  recoverVotingPanels
}
