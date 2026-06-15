class ExecutionCandidateService {
  resolveCandidate(game, nomination, yesVotes, threshold, reachedMajority) {
    if (!reachedMajority) {
      nomination.result = 'no_majority'
      return {
        status: 'no_majority',
        message: `<@${nomination.nomineeId}> is not marked for execution.`
      }
    }

    const current = this.getCurrentCandidate(game)
    if (!current || yesVotes > current.yesVotes) {
      return this.setCandidate(game, nomination, yesVotes, threshold)
    }

    if (yesVotes === current.yesVotes) {
      game.executionCandidate = null
      nomination.result = 'tied_execution_candidate'
      return {
        status: 'tied_execution_candidate',
        message: 'The vote tied the current execution count. No one is currently marked for execution.'
      }
    }

    nomination.result = 'not_enough_to_replace'
    return {
      status: 'not_enough_to_replace',
      message: `<@${nomination.nomineeId}> did not beat the current execution count.`
    }
  }

  getCurrentCandidate(game) {
    const candidate = game.executionCandidate
    if (!candidate || candidate.day !== (game.day || 1)) return null
    return candidate
  }

  setCandidate(game, nomination, yesVotes, threshold) {
    game.executionCandidate = {
      nomineeId: nomination.nomineeId,
      nominationId: nomination.id,
      yesVotes,
      threshold,
      day: game.day || 1
    }
    nomination.result = 'marked_for_execution'

    return {
      status: 'marked_for_execution',
      message: `<@${nomination.nomineeId}> is marked for execution.`
    }
  }

  async finalize(manager, game, member = null) {
    const candidate = this.getCurrentCandidate(game)
    if (!candidate) return this.finalizeNoExecution(manager, game)

    const nomination = (game.nominations || [])
      .find(item => item.id === candidate.nominationId) || null
    const wasDead = this.isDead(game, candidate.nomineeId)
    const shield = wasDead
      ? null
      : await this.findExecutionShield(manager, game, member, nomination, candidate)

    if (shield) return this.finalizeShielded(manager, game, member, nomination, candidate, shield)

    await this.executeNominee(manager, game, member, nomination, candidate)
    game.executionCandidate = null

    return manager.createSuccess({
      executed: true,
      executedPlayer: candidate.nomineeId,
      publicMessage: this.createExecutionPublicMessage(candidate.nomineeId, wasDead)
    })
  }

  async findExecutionShield(manager, game, member, nomination, candidate) {
    if (typeof manager.executionShields?.findForExecution === 'function') {
      return manager.executionShields.findForExecution(manager, game, candidate.nomineeId, {
        member,
        nomination,
        yesVotes: candidate.yesVotes,
        threshold: candidate.threshold
      })
    }

    return manager.executionShields?.find(manager, game, candidate.nomineeId) || null
  }

  async finalizeShielded(manager, game, member, nomination, candidate, shield) {
    manager.executionShields.consume(manager, game, shield, member?.id || game.storytellerId)
    game.executionCandidate = null
    game.executedPlayer = null
    game.executionHistory ??= []
    game.executionHistory.push({
      playerId: candidate.nomineeId,
      day: game.day || 1,
      nominationId: candidate.nominationId,
      yesVotes: candidate.yesVotes,
      threshold: candidate.threshold,
      executed: false,
      preventedBy: shield.type,
      executedAt: Date.now()
    })

    if (nomination) {
      nomination.executed = false
      nomination.finalizedAt = Date.now()
      nomination.result = 'execution_prevented'
      nomination.preventedBy = shield.type
    }

    await manager.roleEngine.modifyVote(manager, game, nomination, {
      yesVotes: candidate.yesVotes,
      threshold: candidate.threshold,
      executed: false,
      finalizingDay: true,
      preventedBy: shield.type
    })

    return manager.createSuccess({
      executed: false,
      protected: true,
      protectedPlayer: candidate.nomineeId,
      protectionType: shield.type,
      publicMessage: `<@${candidate.nomineeId}> is executed, but does not die!`
    })
  }

  async finalizeNoExecution(manager, game) {
    await manager.roleEngine.modifyVote(manager, game, null, {
      yesVotes: 0,
      threshold: manager.voting.getVoteThreshold(game),
      executed: false,
      finalizingDay: true
    })

    game.executionCandidate = null
    game.executedPlayer = null

    return manager.createSuccess({
      executed: false,
      publicMessage: 'No one was executed.'
    })
  }

  async executeNominee(manager, game, member, nomination, candidate) {
    const wasDead = (game.deadPlayers || []).includes(candidate.nomineeId)
    const deadVoteBeforeExecution = game.deadVotes?.[candidate.nomineeId]
    const aliveBeforeDeath = (game.alivePlayers || []).length
    manager.addDeadPlayer(game, candidate.nomineeId)
    if (wasDead && deadVoteBeforeExecution === false) {
      game.deadVotes[candidate.nomineeId] = false
    }
    game.executedPlayer = candidate.nomineeId
    game.executionHistory ??= []
    game.executionHistory.push({
      playerId: candidate.nomineeId,
      day: game.day || 1,
      nominationId: candidate.nominationId,
      yesVotes: candidate.yesVotes,
      threshold: candidate.threshold,
      executed: true,
      executedAt: Date.now()
    })

    if (nomination) {
      nomination.executed = true
      nomination.finalizedAt = Date.now()
      nomination.result = 'executed'
    }

    await manager.roleEngine.handleExecution(manager, game, candidate.nomineeId, {
      aliveBeforeDeath,
      alreadyDead: wasDead,
      member,
      nomination,
      yesVotes: candidate.yesVotes,
      threshold: candidate.threshold
    })

    await manager.emit('PLAYER_LIFE_STATE_CHANGED', {
      game,
      member,
      playerId: candidate.nomineeId,
      lifeState: 'dead'
    })
  }

  createExecutionPublicMessage(playerId, wasDead) {
    return wasDead
      ? `<@${playerId}> is executed, but is already dead!`
      : `<@${playerId}> was executed.`
  }

  isDead(game, playerId) {
    return (game.deadPlayers || []).includes(playerId)
  }
}

module.exports = ExecutionCandidateService
