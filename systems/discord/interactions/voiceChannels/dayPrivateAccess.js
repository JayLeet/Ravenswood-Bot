function setPrivateConversationAccess(game, ownerId, {
  invitedPlayerIds = [],
  publicRoom = false
} = {}) {
  if (!game || !ownerId) return null

  game.playerMadeVoiceAccess ??= {}
  game.playerMadeVoiceAccess[ownerId] = {
    invitedPlayerIds: normalizePlayerIds(invitedPlayerIds),
    publicRoom: publicRoom === true
  }

  return game.playerMadeVoiceAccess[ownerId]
}

function removePrivateConversationAccess(game, ownerId, playerId) {
  const current = getPrivateConversationAccess(game, ownerId)
  return setPrivateConversationAccess(game, ownerId, {
    invitedPlayerIds: current.invitedPlayerIds.filter(id => id !== playerId),
    publicRoom: current.publicRoom
  })
}

function getPrivateConversationAccess(game, ownerId) {
  const access = game?.playerMadeVoiceAccess?.[ownerId]
  if (!access) {
    return {
      invitedPlayerIds: ownerId ? [String(ownerId)] : [],
      publicRoom: false
    }
  }

  return {
    invitedPlayerIds: normalizePlayerIds(access.invitedPlayerIds || []),
    publicRoom: access.publicRoom === true
  }
}

function deletePrivateConversationAccess(game, ownerId) {
  if (game?.playerMadeVoiceAccess) delete game.playerMadeVoiceAccess[ownerId]
}

function findPrivateConversationOwnerByChannel(game, channelId) {
  if (!channelId) return null
  const found = Object.entries(game?.playerMadeVoiceChannels || {})
    .find(([, value]) => value === channelId)
  return found?.[0] || null
}

function normalizePlayerIds(playerIds = []) {
  return [...new Set(playerIds.filter(Boolean).map(String))]
}

module.exports = {
  deletePrivateConversationAccess,
  findPrivateConversationOwnerByChannel,
  getPrivateConversationAccess,
  removePrivateConversationAccess,
  setPrivateConversationAccess
}
