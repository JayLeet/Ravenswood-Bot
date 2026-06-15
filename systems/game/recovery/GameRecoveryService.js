const phases = require('../phases')

const LIVE_PHASES = ['night', 'day', 'nominations']
const DAY_PHASES = ['day', 'nominations']
const ACTIVE_NOMINATION_STATUSES = ['pending_second', 'seconded']
const VALID_STATES = new Set(['lobby', 'in-game', 'ended'])

class GameRecoveryService {
  async recoverGame(manager, game) {
    const summary = {
      changed: false,
      lifecycleAdjusted: false,
      phaseAdjusted: false,
      stateAdjusted: false,
      votingAdjusted: false,
      storytellerAdjusted: false,
      nightActionsCreated: 0,
      nightActionsRepaired: 0,
      nightActionsCancelled: 0
    }

    this.normalizeEngineState(manager, game, summary)
    this.repairLifecycleState(game, summary)
    this.repairStorytellerPointer(game, summary)
    this.repairVotingPhase(manager, game, summary)
    this.repairNightActions(manager, game, summary)

    const created = await this.recoverRoleNightActions(manager, game)
    summary.nightActionsCreated = created.length
    if (created.length) summary.changed = true

    return summary
  }

  normalizeEngineState(manager, game, summary) {
    if (typeof manager.normalizeEngineState !== 'function') return

    const beforePhase = game.phase
    const before = createRecoveryStateSignature(game)
    manager.normalizeEngineState(game)
    if (createRecoveryStateSignature(game) === before) return

    summary.stateAdjusted = true
    if (game.phase !== beforePhase) summary.phaseAdjusted = true
    summary.changed = true
  }

  repairLifecycleState(game, summary) {
    const now = Date.now()

    game.phaseStartedAt ??= game.startedAt || game.createdAt || now
    game.phaseHistory ??= []

    if (!VALID_STATES.has(game.state)) {
      game.state = game.endedAt ? 'ended' : game.startedAt ? 'in-game' : 'lobby'
      this.markLifecycleAdjusted(summary)
    }

    if (game.state === 'lobby' && game.startedAt) {
      game.state = 'in-game'
      this.markLifecycleAdjusted(summary)
    }

    if (game.state === 'lobby' && game.phase !== 'lobby') {
      this.setRecoveredPhase(game, 'lobby', summary, 'recover-lobby')
    }

    if (
      game.state === 'in-game' &&
      (!game.phase || game.phase === 'lobby' || !phases.isKnownPhase(game.phase))
    ) {
      this.setRecoveredPhase(game, 'night', summary, 'recover-missing-live-phase')
    }

    if (game.state === 'in-game' && !LIVE_PHASES.includes(game.phase)) {
      this.setRecoveredPhase(game, 'night', summary, 'recover-invalid-live-phase')
    }

    if (game.state === 'ended' && game.phase !== null) {
      game.phase = null
      summary.phaseAdjusted = true
      this.markLifecycleAdjusted(summary)
    }
  }

  repairStorytellerPointer(game, summary) {
    if (game.storytellerId && game.users?.[game.storytellerId]?.role === 'storyteller') {
      return
    }

    const storytellerEntry = Object.entries(game.users || {})
      .find(([, user]) => user.role === 'storyteller')

    if (!storytellerEntry) return

    game.storytellerId = storytellerEntry[0]
    summary.storytellerAdjusted = true
    summary.changed = true
  }

  repairVotingPhase(manager, game, summary) {
    if (game.state !== 'in-game') return
    const phase = phases.normalizePhaseId(game.phase)
    if (!DAY_PHASES.includes(phase)) return

    const votingNomination = manager.getLatestNomination(game, null, ['voting'])
    if (votingNomination) {
      if (game.phase !== 'nominations') {
        this.setRecoveredPhase(game, 'nominations', summary, 'recover-active-vote')
        summary.votingAdjusted = true
      }
      return
    }

    const activeNomination = manager.getLatestNomination(game, null, ACTIVE_NOMINATION_STATUSES)
    if (activeNomination && game.phase !== 'nominations') {
      this.setRecoveredPhase(game, 'nominations', summary, 'recover-active-nomination')
      summary.votingAdjusted = true
      return
    }

    if (phase === 'nominations' && game.phase !== 'nominations') {
      this.setRecoveredPhase(game, 'day', summary, 'recover-missing-vote')
      summary.votingAdjusted = true
      return
    }

    if (game.phase === 'nominations') return
  }

  repairNightActions(manager, game, summary) {
    const currentNight = game.state === 'in-game' && game.phase === 'night'

    for (const action of game.nightActions || []) {
      const wasChanged = this.normalizeNightAction(manager, game, action)
      if (wasChanged) {
        summary.nightActionsRepaired += 1
        summary.changed = true
      }

      const unresolved = ['awaiting_target', 'submitted'].includes(action.status)
      const stale = unresolved && (!currentNight || action.day !== game.day || action.phase !== game.phase)

      if (!stale) continue

      action.status = 'cancelled'
      action.cancelledAt = Date.now()
      action.cancelReason = 'Recovered outside its original night phase'
      summary.nightActionsCancelled += 1
      summary.changed = true
    }
  }

  normalizeNightAction(manager, game, action) {
    let changed = false

    if (!action.status && action.type === 'night_target') {
      action.status = 'awaiting_target'
      changed = true
    }

    if (action.source === 'role_engine' && action.roleId) {
      const role = manager.scripts.getRole(game.scriptId, action.roleId)
      const behavior = manager.roleEngine.getBehavior(manager, game, role)
      const nightAction = behavior?.nightAction

      if (role?.name && !action.roleName) {
        action.roleName = role.name
        changed = true
      }

      if (nightAction?.prompt && !action.prompt) {
        action.prompt = nightAction.prompt
        changed = true
      }

      if (nightAction?.target && !action.targetType) {
        action.targetType = nightAction.target
        changed = true
      }

      if (nightAction?.targetCount && !action.targetCount) {
        action.targetCount = nightAction.targetCount
        changed = true
      }

      if (nightAction?.allowSelf !== undefined && action.allowSelf === undefined) {
        action.allowSelf = nightAction.allowSelf
        changed = true
      }
    }

    if (!Array.isArray(action.targetIds)) {
      action.targetIds = action.targetId ? [action.targetId] : []
      changed = true
    }

    return changed
  }

  async recoverRoleNightActions(manager, game) {
    if (game.state !== 'in-game' || game.phase !== 'night') return []

    return manager.roleEngine.createNightActionsForPhase(manager, game, {
      createdBy: game.storytellerId,
      reason: 'recovery',
      emit: false
    })
  }

  setRecoveredPhase(game, phase, summary, reason) {
    phases.recoverPhase(game, phase, { reason })
    summary.phaseAdjusted = true
    summary.changed = true
  }

  markLifecycleAdjusted(summary) {
    summary.lifecycleAdjusted = true
    summary.changed = true
  }
}

function createRecoveryStateSignature(game) {
  return JSON.stringify({
    alivePlayers: game.alivePlayers || [],
    deadPlayers: game.deadPlayers || [],
    deadVotes: game.deadVotes || {},
    executionCandidate: game.executionCandidate || null,
    executionHistory: game.executionHistory || [],
    executionShields: game.executionShields || {},
    mastermindFinalDay: game.mastermindFinalDay || null,
    nightActions: game.nightActions || [],
    nightAreaSlots: game.nightAreaSlots || {},
    nightChannels: game.nightChannels || {},
    nightCottageStatusMessages: game.nightCottageStatusMessages || {},
    nightInfoPromptMessages: game.nightInfoPromptMessages || {},
    nightInfoNoticeMessages: game.nightInfoNoticeMessages || {},
    nightOptions: game.nightOptions || {},
    nightPromptMessages: game.nightPromptMessages || {},
    nightVoiceChannels: game.nightVoiceChannels || {},
    nominations: game.nominations || [],
    nominationRequests: game.nominationRequests || [],
    paused: game.paused || null,
    pendingEndReveal: game.pendingEndReveal || null,
    pendingManualImpReplacement: game.pendingManualImpReplacement || null,
    pendingNightDeaths: game.pendingNightDeaths || [],
    pendingRoleInfoUpdates: game.pendingRoleInfoUpdates || {},
    pendingWin: game.pendingWin || null,
    phase: game.phase,
    phaseHistory: game.phaseHistory || [],
    playerGrimoires: game.playerGrimoires || {},
    playerMadeVoiceChannels: game.playerMadeVoiceChannels || {},
    playerMadeVoiceAccess: game.playerMadeVoiceAccess || {},
    replacementSlot: game.replacementSlot || null,
    roleHistory: game.roleHistory || {},
    roleInfoPromptMessages: game.roleInfoPromptMessages || {},
    roleInfoSent: game.roleInfoSent || {},
    roles: game.roles || {},
    shownRoles: game.shownRoles || {},
    statusEffects: game.statusEffects || {},
    storytellerMoveRequests: game.storytellerMoveRequests || {},
    substituteBriefings: game.substituteBriefings || {}
  })
}

module.exports = GameRecoveryService
