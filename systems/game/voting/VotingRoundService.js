const guards = require('./VotingConcurrencyGuards')

class VotingRoundService {
  constructor(voting) {
    this.voting = voting
  }

  async secondNomination(manager, guildId, member, nominationId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    const nomination = (game.nominations || []).find(nomination => nomination.id === nominationId)
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination not found')

    const live = guards.assertNominationLive(
      manager,
      game,
      nomination,
      ['pending_second'],
      ['nominations'],
      'That nomination is not waiting for a second'
    )
    if (!live.ok) return live

    if (manager.getRole(game, member.id) !== 'player') {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can second nominations')
    }

    if (!(game.alivePlayers || []).includes(member.id)) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only living players can second nominations')
    }

    if (nomination.nomineeId === member.id) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'A nominee cannot second their own nomination')
    }

    nomination.secondedBy = member.id
    nomination.status = 'seconded'
    nomination.secondedAt = Date.now()

    await manager.emit('NOMINATION_SECONDED', { game, member, nomination })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      view: manager.serializeGame(game, { guildId })
    })
  }

  async openVote(manager, guildId, member, nomineeId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, nomineeId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, nomineeId, ['pending_second', 'seconded'])

    if (!nomination) {
      return manager.createError(manager.errorTypes.NOT_FOUND, 'No seconded nomination found for that player')
    }

    const live = guards.assertNominationLive(
      manager,
      game,
      nomination,
      ['seconded'],
      ['nominations'],
      'That nomination needs a second before voting opens'
    )
    if (!live.ok) return live

    nomination.status = 'voting'
    nomination.voteOpenedAt = Date.now()
    nomination.threshold = this.voting.getVoteThreshold(game)
    nomination.voteClockhandSpeedMs = this.voting.normalizeVoteClockhandSpeedMs(game.voteClockhandSpeedMs)
    nomination.yesVotes = 0
    nomination.pertinencePlayerIds = []
    delete nomination.voteCancelledAt
    delete nomination.voteCancelledBy
    game.votes = (game.votes || []).filter(vote => vote.nominationId !== nomination.id)

    await manager.emit('VOTE_OPENED', { game, member, nomination })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      view: manager.serializeGame(game, { guildId })
    })
  }

  async castVote(manager, guildId, member, nominationId, value) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    const nomination = (game.nominations || []).find(nomination => nomination.id === nominationId)
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination not found')

    const live = guards.assertNominationLive(
      manager,
      game,
      nomination,
      ['voting'],
      ['nominations'],
      'Voting is not open for that nomination'
    )
    if (!live.ok) return live

    if (manager.getRole(game, member.id) !== 'player') {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can use this button.')
    }

    const isAlive = (game.alivePlayers || []).includes(member.id)
    const isDead = (game.deadPlayers || []).includes(member.id)

    if (!isAlive && !isDead) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can use this button.')
    }

    const previousVote = (game.votes || []).find(vote =>
      vote.nominationId === nomination.id && vote.userId === member.id
    )
    const isClearingRaisedDeadVote = !value && isDead && previousVote?.value === true

    if (isDead && game.deadVotes?.[member.id] === false && !isClearingRaisedDeadVote) {
      return manager.createError(
        manager.errorTypes.PERMISSION_DENIED,
        'Your dead vote has already been spent'
      )
    }

    game.votes = (game.votes || []).filter(vote =>
      !(vote.nominationId === nomination.id && vote.userId === member.id)
    )

    if (isClearingRaisedDeadVote) {
      game.deadVotes ??= {}
      game.deadVotes[member.id] = true
    }

    if (value) {
      game.votes.push({
        nominationId: nomination.id,
        userId: member.id,
        value: true,
        createdAt: Date.now()
      })

      if (isDead) {
        game.deadVotes ??= {}
        game.deadVotes[member.id] = false
      }
    }

    nomination.yesVotes = this.voting.countYesVotes(game, nomination.id)
    await manager.emit('VOTE_CAST', { game, member, nomination, value })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      view: manager.serializeGame(game, { guildId })
    })
  }
}

module.exports = VotingRoundService
