function createSubstitutionHistory(previousUser, oldPlayerId, newPlayerId, substitutedAt = Date.now()) {
  const previousHistory = previousUser?.substitutionHistory || {}
  const previousPlayerIds = Array.isArray(previousHistory.previousPlayerIds)
    ? [...previousHistory.previousPlayerIds]
    : []

  if (!previousPlayerIds.includes(oldPlayerId)) previousPlayerIds.push(oldPlayerId)

  return {
    originalPlayerId: previousHistory.originalPlayerId || previousUser?.substituteFor || oldPlayerId,
    previousPlayerIds,
    currentPlayerId: newPlayerId,
    lastSubstitutedAt: substitutedAt
  }
}

module.exports = {
  createSubstitutionHistory
}
