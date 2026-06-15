const defaultBehaviors = require('./RoleBehaviorRegistry')
const ability = require('./RoleAbilityEligibility')
const {
  getFirstNightInfoPriority,
  isReceivedInfoConfirmation,
  shouldCreateFirstNightInfoCandidate
} = require('./FirstNightInfoRules')
const { getDemonDeathPriority } = require('./DemonDeathPriority')
const {
  findExecutionShield
} = require('./ExecutionShieldHooks')

class RoleExecutionEngine {
  constructor({ behaviorRegistry = defaultBehaviors } = {}) {
    this.behaviorRegistry = behaviorRegistry
  }

  getRole(manager, game, playerId) {
    const roleId = game.roles?.[playerId] || null
    return roleId ? manager.scripts.getRole(game.scriptId, roleId) : null
  }

  getBehavior(manager, game, role) {
    if (!role?.id) return null
    const scriptBehavior = typeof manager?.scripts?.getRoleBehavior === 'function'
      ? manager.scripts.getRoleBehavior(game?.scriptId, role.id) || {}
      : {}
    return { ...(this.behaviorRegistry[role.id] || {}), ...scriptBehavior, ...(role.behaviors || {}) }
  }

  createRoleContext(manager, game, role, context = {}) {
    return { manager, game, role, roleId: role?.id || null, ...context }
  }

  getNightType(game) {
    return (game.day || 1) <= 1 ? 'firstNight' : 'otherNights'
  }

  getNightOrder(manager, game) {
    const script = manager.scripts.getScript(game.scriptId)
    return script?.nightOrder?.[this.getNightType(game)] || []
  }

  listNightActionCandidates(manager, game) {
    if (game.state !== 'in-game' || game.phase !== 'night') return []
    const info = this.getNightType(game) === 'firstNight'
      ? this.listFirstNightInfoCandidates(manager, game)
      : []
    return [...info, ...this.listScriptNightActionCandidates(manager, game)]
  }

  listFirstNightDemonInfoCandidates(manager, game) {
    return this.listFirstNightInfoCandidates(manager, game)
      .filter(candidate => candidate.role?.team === 'demon')
  }

  listFirstNightInfoCandidates(manager, game) {
    const script = manager.scripts.getScript(game.scriptId)
    return Object.entries(game.roles || {})
      .map(([playerId, roleId]) => ({ playerId, role: manager.scripts.getRole(game.scriptId, roleId) }))
      .filter(candidate => candidate.role && ability.isAlive(game, candidate.playerId))
      .map(candidate => ({ ...candidate, behavior: this.getBehavior(manager, game, candidate.role) }))
      .filter(candidate => shouldCreateFirstNightInfoCandidate(
        script,
        candidate.role,
        this.canFoldReceiptHook(manager, game, candidate, candidate.behavior)
      ))
      .sort((a, b) => getFirstNightInfoPriority(a.role) - getFirstNightInfoPriority(b.role))
      .map(candidate => ({
        ...candidate,
        purpose: 'first_night_info',
        nightAction: this.createFirstNightInfoAction(manager, game, candidate, candidate.behavior)
      }))
  }

  createFirstNightInfoAction(manager, game, candidate, behavior) {
    const canUseReceiptHook = this.canFoldReceiptHook(manager, game, candidate, behavior)
    return {
      prompt: null,
      target: 'self',
      infoOnly: true,
      skipRoleHook: !canUseReceiptHook
    }
  }

  canFoldReceiptHook(manager, game, candidate, behavior) {
    const nightAction = behavior?.nightAction
    if (!isReceivedInfoConfirmation(nightAction)) return false
    if (!this.getNightOrder(manager, game).includes(candidate.role.id)) return false
    if (!this.canWakeForNightAction(game, candidate.playerId, nightAction)) return false
    return this.meetsNightActionCondition(manager, game, candidate.playerId, candidate.role, nightAction)
  }

  listScriptNightActionCandidates(manager, game) {
    const candidates = []
    for (const roleId of this.getNightOrder(manager, game)) {
      const role = manager.scripts.getRole(game.scriptId, roleId)
      const behavior = this.getBehavior(manager, game, role)
      const nightAction = behavior?.nightAction
      if (!nightAction) continue
      if (this.getNightType(game) === 'firstNight' && isReceivedInfoConfirmation(nightAction)) continue
      for (const playerId of this.getPlayersWithRole(game, roleId)) {
        if (!this.canWakeForNightAction(game, playerId, nightAction)) continue
        if (!this.meetsNightActionCondition(manager, game, playerId, role, nightAction)) continue
        candidates.push({ playerId, role, behavior, purpose: 'night_action', nightAction })
      }
    }
    return candidates
  }

  getPlayersWithRole(game, roleId) {
    return Object.entries(game.roles || {})
      .filter(([, assignedRoleId]) => assignedRoleId === roleId)
      .map(([playerId]) => playerId)
  }

  canWakeForNightAction(game, playerId, nightAction) {
    return nightAction.includeDead || ability.isAlive(game, playerId)
  }

  meetsNightActionCondition(manager, game, playerId, role, nightAction) {
    if (typeof nightAction.condition !== 'function') return true
    return nightAction.condition(this.createRoleContext(manager, game, role, { playerId, actorId: playerId })) !== false
  }

  hasNightActionForCandidate(game, candidate) {
    const purpose = candidate.purpose || 'night_action'
    return (game.nightActions || []).some(action =>
      action.source === 'role_engine' && action.day === game.day && action.phase === game.phase &&
      action.playerId === candidate.playerId && action.roleId === candidate.role.id &&
      (action.purpose || 'night_action') === purpose
    )
  }

  async createNightActionsForPhase(manager, game, options = {}) {
    const actions = []
    for (const candidate of this.listNightActionCandidates(manager, game)) {
      if (this.hasNightActionForCandidate(game, candidate)) continue
      actions.push(await this.createNightAction(manager, game, candidate, options))
    }
    return actions
  }

  async createNightAction(manager, game, candidate, options = {}) {
    const nightAction = candidate.nightAction
    const action = manager.nightActions.createTargetAction(game, {
      guildId: game.guildId,
      playerId: candidate.playerId,
      roleId: candidate.role.id,
      createdBy: options.createdBy || game.storytellerId || null,
      source: 'role_engine',
      autoPrompt: options.autoPrompt === true,
      behaviorId: candidate.role.id,
      roleName: candidate.role.name,
      prompt: nightAction.prompt || null,
      targetType: nightAction.target || 'player',
      targetCount: nightAction.targetCount || 1,
      allowSelf: nightAction.allowSelf !== false,
      allowDeadActor: nightAction.includeDead === true,
      infoOnly: nightAction.infoOnly === true,
      skipRoleHook: nightAction.skipRoleHook === true,
      purpose: candidate.purpose || 'night_action'
    })
    if (options.emit !== false) {
      await manager.emit('NIGHT_ACTION_CREATED', {
        game,
        member: null,
        playerId: candidate.playerId,
        action,
        source: 'role_engine',
        reason: options.reason || null
      })
    }
    return action
  }

  async resolveNightAction(manager, game, action, resolvedBy) {
    const actorId = action.actorId || action.playerId
    const role = action.roleId ? manager.scripts.getRole(game.scriptId, action.roleId) : this.getRole(manager, game, action.playerId)
    const behavior = this.getBehavior(manager, game, role)
    const hook = behavior?.onNight
    if (action.infoOnly || action.skipRoleHook === true || typeof hook !== 'function') return null
    if (!ability.canDeadActorUseNightAction(game, action, actorId)) return ability.recordDeadAbilityBlocked(manager, game, action, role)
    const result = await hook(this.createRoleContext(manager, game, role, {
      actorId,
      action,
      targetId: action.targetId || null,
      targetIds: action.targetIds || [action.targetId].filter(Boolean),
      resolvedBy
    }))
    action.result = result || null
    await manager.emit('ROLE_NIGHT_ACTION_RESOLVED', { game, action, role, result })
    return result || null
  }

  async handleDeath(manager, game, playerId, context = {}) {
    const role = this.getRole(manager, game, playerId)
    const result = await this.callRoleHook(manager, game, playerId, 'onDeath', context)
    const demonResult = await this.callDemonDeathHooks(manager, game, playerId, role, context)
    return demonResult || result
  }

  async handleExecution(manager, game, playerId, context = {}) {
    const role = this.getRole(manager, game, playerId)
    const result = await this.callRoleHook(manager, game, playerId, 'onExecution', context)
    const demonResult = await this.callDemonDeathHooks(manager, game, playerId, role, context)
    return demonResult || result
  }

  async findExecutionShield(manager, game, targetId, context = {}) {
    return findExecutionShield(this, manager, game, targetId, context)
  }

  async callDemonDeathHooks(manager, game, demonId, deadRole, context = {}) {
    if (deadRole?.team !== 'demon') return null
    const candidates = this.getDemonDeathHookCandidates(manager, game)
    for (const { playerId, role, behavior } of candidates) {
      if (typeof behavior?.onDemonDeath !== 'function') continue
      const result = await behavior.onDemonDeath(this.createRoleContext(manager, game, role, {
        ...context,
        demonId,
        deadRole,
        deadRoleId: deadRole.id,
        playerId
      }))
      await manager.emit('ROLE_HOOK_RESOLVED', { game, playerId, role, hook: 'onDemonDeath', result })
      if (result) return result
    }
    return null
  }

  getDemonDeathHookCandidates(manager, game) {
    return manager.getPlayerIds(game)
      .filter(playerId => ability.isAlive(game, playerId))
      .map(playerId => {
        const role = this.getRole(manager, game, playerId)
        return { playerId, role, behavior: this.getBehavior(manager, game, role) }
      })
      .sort((left, right) => this.getDemonDeathPriority(left.role, left.behavior) - this.getDemonDeathPriority(right.role, right.behavior))
  }

  getDemonDeathPriority(role, behavior = null) {
    return getDemonDeathPriority(role, behavior)
  }

  async handlePhaseStart(manager, game, transition, context = {}) {
    const results = await this.callAllRoleHooks(manager, game, 'onPhaseStart', {
      transition,
      phase: transition?.to || game.phase,
      ...context
    })
    if (transition?.to === 'night' || game.phase === 'night') {
      const nightResults = await this.callAllRoleHooks(manager, game, 'onNightStart', { transition, ...context })
      results.push(...nightResults)
      const actions = await this.createNightActionsForPhase(manager, game, {
        createdBy: context.createdBy || game.storytellerId,
        reason: context.reason || 'phase-start'
      })
      if (actions.length) results.push({ hook: 'createNightActionsForPhase', result: { actionsCreated: actions.length } })
    }
    return results
  }

  async callRoleHook(manager, game, playerId, hookName, context = {}) {
    if (!ability.canUseHookWhileDead(game, playerId, hookName)) return null
    const role = this.getRole(manager, game, playerId)
    const behavior = this.getBehavior(manager, game, role)
    const hook = behavior?.[hookName]
    if (typeof hook !== 'function') return null
    const result = await hook(this.createRoleContext(manager, game, role, { playerId, ...context }))
    await manager.emit('ROLE_HOOK_RESOLVED', { game, playerId, role, hook: hookName, result })
    return result || null
  }

  async callAllRoleHooks(manager, game, hookName, context = {}) {
    const results = []
    for (const playerId of manager.getPlayerIds(game)) {
      const result = await this.callRoleHook(manager, game, playerId, hookName, context)
      if (result) results.push({ playerId, hook: hookName, result })
    }
    return results
  }

  async modifyVote(manager, game, nomination, voteContext) {
    let next = { ...voteContext }
    for (const playerId of manager.getPlayerIds(game)) {
      if (!ability.isAlive(game, playerId)) continue
      const role = this.getRole(manager, game, playerId)
      const behavior = this.getBehavior(manager, game, role)
      if (typeof behavior?.modifyVote !== 'function') continue
      const modified = await behavior.modifyVote(this.createRoleContext(manager, game, role, { nomination, playerId, vote: next }))
      if (modified) next = { ...next, ...modified }
    }
    return next
  }
}

module.exports = RoleExecutionEngine
