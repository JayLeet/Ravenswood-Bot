const KEYED_PLAYER_STATE = [
  'deadVotes',
  'demonNotInPlayRoles',
  'nightAreaSlots',
  'nightChannels',
  'nightInfoPromptMessages',
  'nightPromptMessages',
  'nightVoiceChannels',
  'pendingRoleInfoUpdates',
  'playerMadeVoiceAccess',
  'playerMadeVoiceChannels',
  'roleHistory',
  'roleInfoPromptMessages',
  'roleInfoSent',
  'roles',
  'shownRoles',
  'statusEffects',
  'storytellerMoveRequests',
  'substituteBriefings',
  'zombuulDeaths'
]

const PLAYER_ID_FIELDS = [
  'actorId',
  'createdBy',
  'deadDemonId',
  'executedPlayer',
  'kickedBy',
  'leftBy',
  'nominatorId',
  'nomineeId',
  'oldPlayerId',
  'playerId',
  'requestedBy',
  'resolvedBy',
  'secondedBy',
  'sourcePlayerId',
  'storytellerId',
  'targetId',
  'userId'
]

function getReplaceableFakePlayerId(game) {
  if (!game?.testMode || game.state !== 'lobby') return null

  return Object.entries(game.users || {})
    .find(([, user]) => user.role === 'player' && user.fake === true)?.[0] || null
}

function replaceFakeTestPlayerWithMember(game, fakePlayerId, member) {
  if (!fakePlayerId || !member?.id || !game?.users?.[fakePlayerId]) return null

  const newPlayerId = member.id
  replaceUserRecord(game.users, fakePlayerId, newPlayerId, createRealPlayerUser(game.users[fakePlayerId]))

  replaceIdInArray(game.alivePlayers, fakePlayerId, newPlayerId)
  replaceIdInArray(game.deadPlayers, fakePlayerId, newPlayerId)
  for (const stateKey of KEYED_PLAYER_STATE) moveKey(game[stateKey], fakePlayerId, newPlayerId)
  moveKey(game.executionShields?.foolSpent, fakePlayerId, newPlayerId)
  replacePlayerGrimoireIds(game, fakePlayerId, newPlayerId)

  replacePlayerIdReferences(game.requests, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.nominationRequests, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.nominations, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.executionHistory, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.nightActions, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.reminders, fakePlayerId, newPlayerId)
  replacePlayerIdReferences(game.votes, fakePlayerId, newPlayerId)

  replacePlayerIdFields(game, fakePlayerId, newPlayerId)
  replacePlayerIdFields(game.executionCandidate, fakePlayerId, newPlayerId)
  replacePlayerIdFields(game.paused, fakePlayerId, newPlayerId)
  replacePlayerIdFields(game.pendingEndReveal, fakePlayerId, newPlayerId)
  replacePlayerIdFields(game.pendingManualImpReplacement, fakePlayerId, newPlayerId)
  replacePlayerIdFields(game.replacementSlot, fakePlayerId, newPlayerId)

  return { fakePlayerId, playerId: newPlayerId }
}

function createRealPlayerUser(fakeUser) {
  const { displayName, fake, ...playerUser } = fakeUser || {}
  return {
    ...playerUser,
    role: 'player'
  }
}

function replaceUserRecord(users, oldId, newId, newUser) {
  const nextUsers = {}

  for (const [userId, user] of Object.entries(users || {})) {
    if (userId === oldId) {
      nextUsers[newId] = newUser
    } else if (userId !== newId) {
      nextUsers[userId] = user
    }
  }

  for (const userId of Object.keys(users || {})) delete users[userId]
  Object.assign(users, nextUsers)
}

function replacePlayerGrimoireIds(game, oldId, newId) {
  moveKey(game.playerGrimoires, oldId, newId)

  for (const notes of Object.values(game.playerGrimoires || {})) {
    moveKey(notes, oldId, newId)
  }
}

function replacePlayerIdReferences(records, oldId, newId) {
  for (const record of records || []) replacePlayerIdFields(record, oldId, newId)
}

function replacePlayerIdFields(record, oldId, newId) {
  if (!record || typeof record !== 'object') return

  for (const field of PLAYER_ID_FIELDS) {
    if (record[field] === oldId) record[field] = newId
  }

  for (const field of ['candidates', 'countedVotePlayerIds', 'revealedPlayers', 'targetIds']) {
    replaceIdInArray(record[field], oldId, newId)
  }
}

function replaceIdInArray(array, oldId, newId) {
  if (!Array.isArray(array)) return

  const index = array.indexOf(oldId)
  if (index !== -1) array[index] = newId
}

function moveKey(object, oldKey, newKey) {
  if (!object || !Object.prototype.hasOwnProperty.call(object, oldKey)) return

  object[newKey] = object[oldKey]
  delete object[oldKey]
}

module.exports = {
  getReplaceableFakePlayerId,
  replaceFakeTestPlayerWithMember
}
