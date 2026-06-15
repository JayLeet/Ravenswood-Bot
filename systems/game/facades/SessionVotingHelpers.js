const {
  getNextClockhandPlayerId
} = require('../../../utils/voteClockhand')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'SessionVotingHelpers' })

async function castNominationHandVote(manager, game, guildId, member, nomination, value) {
  const participant = assertNominationPlayer(manager, game, member)
  if (!participant.ok) return participant

  const previousVote = (game.votes || []).find(vote =>
    vote.nominationId === nomination.id && vote.userId === member.id
  )
  if (participant.isDead && game.deadVotes?.[member.id] === false) {
    return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Your dead vote has already been spent')
  }

  game.votes = (game.votes || []).filter(vote =>
    !(vote.nominationId === nomination.id && vote.userId === member.id)
  )

  if (!value && participant.isDead && previousVote?.value === true) {
    game.deadVotes ??= {}
    game.deadVotes[member.id] = true
  }

  if (value) addHandVote(game, nomination, member.id, participant.isDead)

  nomination.yesVotes = manager.voting.countYesVotes(game, nomination.id)
  await manager.emit('VOTE_CAST', { game, member, nomination, value })
  manager.save()

  return manager.createSuccess({
    nomination: manager.voting.serializeNomination(game, nomination),
    view: manager.serializeGame(game, { guildId })
  })
}

async function toggleNominationPertinence(manager, game, guildId, member, nomination) {
  const participant = assertNominationPlayer(manager, game, member)
  if (!participant.ok) return participant

  if (nomination.status !== 'seconded') {
    return manager.createError(manager.errorTypes.INVALID_STATE, 'Pertinence is only available before the vote starts')
  }

  nomination.pertinencePlayerIds = toggleId(nomination.pertinencePlayerIds || [], member.id)
  const active = nomination.pertinencePlayerIds.includes(member.id)

  await manager.emit('PERTINENCE_CHANGED', { game, member, nomination, active })
  manager.save()

  return manager.createSuccess({
    active,
    nomination: manager.voting.serializeNomination(game, nomination),
    view: manager.serializeGame(game, { guildId })
  })
}

function assertNominationPlayer(manager, game, member) {
  if (manager.getRole(game, member.id) !== 'player') {
    return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can use this button.')
  }

  const isAlive = (game.alivePlayers || []).includes(member.id)
  const isDead = (game.deadPlayers || []).includes(member.id)
  if (!isAlive && !isDead) {
    return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can use this button.')
  }

  return manager.createSuccess({ isAlive, isDead })
}

function toggleId(ids, userId) {
  return ids.includes(userId)
    ? ids.filter(id => id !== userId)
    : [...ids, userId]
}

function addHandVote(game, nomination, userId, isDead) {
  game.votes.push({
    nominationId: nomination.id,
    userId,
    value: true,
    createdAt: Date.now()
  })
  if (!isDead) return
  game.deadVotes ??= {}
  game.deadVotes[userId] = false
}

function emitVoteCounted(manager, game, member, nomination, countedPlayerId) {
  const emitted = manager.emit('VOTE_COUNTED', { game, member, nomination, countedPlayerId })
  if (typeof emitted?.catch === 'function') {
    emitted.catch(err => log.recoverable('emit-vote-counted', err, {
      countedPlayerId,
      guildId: game.guildId,
      memberId: member.id,
      nominationId: nomination.id
    }))
  }
}

function emitVoteOpened(manager, game, member, nomination) {
  const emitted = manager.emit('VOTE_OPENED', { game, member, nomination })
  if (typeof emitted?.catch === 'function') {
    emitted.catch(err => log.recoverable('emit-vote-opened', err, {
      guildId: game.guildId,
      memberId: member.id,
      nominationId: nomination.id
    }))
  }
}

function getControlledVotingGame(manager, guildId, member) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')
  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only the Storyteller can do that')
  }
  if (game.phase !== 'nominations') {
    return manager.createError(manager.errorTypes.INVALID_STATE, 'Voting controls are only available during nominations')
  }
  return manager.createSuccess({ game })
}

function getNextCountedPlayer(game, nomination) {
  return getNextClockhandPlayerId({
    playerIds: Object.entries(game.users || {})
      .filter(([, user]) => user.role === 'player')
      .map(([userId]) => userId),
    alivePlayerIds: game.alivePlayers || [],
    deadPlayerIds: game.deadPlayers || [],
    deadVotes: game.deadVotes || {},
    votes: game.votes || [],
    nominationId: nomination.id,
    startPlayerId: nomination.nomineeId
  }, nomination.countedVotePlayerIds || [])
}

function hasBeenCounted(nomination, userId) {
  return (nomination.countedVotePlayerIds || []).includes(userId)
}

module.exports = {
  castNominationHandVote,
  emitVoteCounted,
  emitVoteOpened,
  getControlledVotingGame,
  getNextCountedPlayer,
  hasBeenCounted,
  toggleNominationPertinence
}
