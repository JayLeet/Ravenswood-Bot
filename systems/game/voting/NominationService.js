const guards = require('./VotingConcurrencyGuards')

class NominationService {
  constructor(voting) {
    this.voting = voting
  }

  async createNomination(manager, guildId, member, nomineeId, options = {}) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    const nominatorId = options.nominatorId || member.id
    const validation = this.validateNomination(manager, game, nominatorId, nomineeId, options)
    if (!validation.ok) return validation

    const nomination = this.createNominationRecord(game, guildId, nominatorId, nomineeId, options)
    game.nominations ??= []
    game.nominations.push(nomination)

    await manager.emit('NOMINATION_CREATED', { game, member, nomination })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      view: manager.serializeGame(game, { guildId })
    })
  }

  validateNomination(manager, game, nominatorId, nomineeId, options = {}) {
    if (game.phase !== 'nominations') {
      return manager.createError(
        manager.errorTypes.INVALID_STATE,
        'Nominations are only open after the Storyteller advances to nominations'
      )
    }

    if (!options.manualStorytellerNomination && this.hasNominatedToday(game, nominatorId)) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'That player has already nominated today')
    }

    if (!options.forceStorytellerNomination && this.hasBeenNominatedToday(game, nomineeId)) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'That player has already been nominated today')
    }

    const noOpenVote = guards.assertNoOpenVote(manager, game)
    if (!noOpenVote.ok) return noOpenVote

    if (!options.manualStorytellerNomination) {
      const nominator = this.validateNominator(manager, game, nominatorId)
      if (!nominator.ok) return nominator
    }

    return this.validateNominee(manager, game, nomineeId)
  }

  validateNominator(manager, game, nominatorId) {
    if (manager.getRole(game, nominatorId) !== 'player') {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only players can nominate')
    }

    if (!(game.alivePlayers || []).includes(nominatorId)) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only living players can nominate')
    }

    return manager.createSuccess()
  }

  validateNominee(manager, game, nomineeId) {
    const role = manager.getRole(game, nomineeId)

    if (role === 'storyteller') {
      if (this.scriptHasAtheist(manager, game)) return manager.createSuccess()
      return manager.createError(
        manager.errorTypes.INVALID_STATE,
        'The Storyteller can only be nominated when the script contains Atheist'
      )
    }

    if (role !== 'player') {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Only players can be nominated')
    }

    return manager.createSuccess()
  }

  createNominationRecord(game, guildId, nominatorId, nomineeId, options = {}) {
    return {
      id: `${Date.now()}-nomination-${nomineeId}`,
      guildId,
      day: game.day || 1,
      nominatorId,
      nomineeId,
      forceStorytellerNomination: !!options.forceStorytellerNomination,
      manualStorytellerNomination: !!options.manualStorytellerNomination,
      secondedBy: null,
      status: 'seconded',
      threshold: this.voting.getVoteThreshold(game),
      yesVotes: 0,
      executed: false,
      result: null,
      messageId: null,
      channelId: null,
      createdAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null
    }
  }

  hasNominatedToday(game, nominatorId) {
    return (game.nominations || []).some(nomination =>
      nomination.day === (game.day || 1) &&
      nomination.nominatorId === nominatorId &&
      !nomination.manualStorytellerNomination
    )
  }

  hasBeenNominatedToday(game, nomineeId) {
    return (game.nominations || []).some(nomination =>
      nomination.day === (game.day || 1) &&
      nomination.nomineeId === nomineeId &&
      !nomination.forceStorytellerNomination
    )
  }

  scriptHasAtheist(manager, game) {
    return !!manager.scripts.getRole(game.scriptId, 'atheist')
  }
}

module.exports = NominationService
