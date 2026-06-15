const ERROR_TYPES = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ALREADY_IN_GAME: 'ALREADY_IN_GAME',
  GAME_FULL: 'GAME_FULL',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED'
}

const EventBus = require('./game/lifecycle/EventBus')
const SessionHistoryService = require('./game/history/SessionHistoryService')
const ReminderService = require('./game/reminders/ReminderService')
const NightActionService = require('./game/night/NightActionService')
const CleanupService = require('./game/cleanup/CleanupService')
const ScriptService = require('./game/scripts/ScriptService')
const ScriptSelectionService = require('./game/scripts/ScriptSelectionService')
const VotingService = require('./game/voting/VotingService')
const ExecutionShieldService = require('./game/voting/ExecutionShieldService')
const SubstitutionTrackingAdminService = require('./game/admin/SubstitutionTrackingAdminService')
const ChannelRegistryService = require('./game/channels/ChannelRegistryService')
const RequestService = require('./game/requests/RequestService')
const PlayerGrimoireService = require('./game/playerGrimoire/PlayerGrimoireService')
const GameSerializer = require('./game/serialization/GameSerializer')
const GameSessionService = require('./game/lifecycle/GameSessionService')
const RoleAssignmentService = require('./game/roles/RoleAssignmentService')
const LunaticInfoService = require('./game/roles/LunaticInfoService')
const RoleExecutionEngine = require('./game/roles/RoleExecutionEngine')
const WinConditionService = require('./game/win/WinConditionService')
const GameRecoveryService = require('./game/recovery/GameRecoveryService')
const GameStateNormalizer = require('./game/state/GameStateNormalizer')
const PlayerStateService = require('./game/state/PlayerStateService')
const {
  createGameLifecycleRuntimeState
} = require('./game/diagnostics/GameLifecycleRuntimeState')
const phases = require('./game/phases')
const roles = require('./game/roles')
const ChannelFacade = require('./game/facades/ChannelFacade')
const CleanupRecoveryFacade = require('./game/facades/CleanupRecoveryFacade')
const RequestAdminScriptFacade = require('./game/facades/RequestAdminScriptFacade')
const PlayerGrimoireFacade = require('./game/facades/PlayerGrimoireFacade')
const LunaticInfoFacade = require('./game/facades/LunaticInfoFacade')
const RoleReminderNightFacade = require('./game/facades/RoleReminderNightFacade')
const SessionVotingFacade = require('./game/facades/SessionVotingFacade')
const StateFacade = require('./game/facades/StateFacade')

class GameLifecycleManager {
  constructor({
    deletePendingGameSummary = null,
    gameManager,
    loadCreateGameCooldowns = null,
    saveCreateGameCooldown = null,
    saveGames,
    savePendingGameSummary = null,
    updateAchievementStats = null
  }) {
    this.gameManager = gameManager
    this.saveGames = saveGames
    this.saveCreateGameCooldown = saveCreateGameCooldown
    this.createGameCooldowns = typeof loadCreateGameCooldowns === 'function'
      ? loadCreateGameCooldowns()
      : new Map()
    this.sessionHistory = new SessionHistoryService({
      deletePendingGameSummary,
      savePendingGameSummary,
      updateAchievementStats
    })
    this.reminders = new ReminderService()
    this.nightActions = new NightActionService()
    this.cleanup = new CleanupService()
    this.scripts = new ScriptService()
    this.scriptSelection = new ScriptSelectionService({ errorTypes: ERROR_TYPES })
    this.voting = new VotingService()
    this.executionShields = new ExecutionShieldService()
    this.admin = new SubstitutionTrackingAdminService({ errorTypes: ERROR_TYPES })
    this.channels = new ChannelRegistryService()
    this.session = new GameSessionService({ errorTypes: ERROR_TYPES })
    this.stateNormalizer = new GameStateNormalizer()
    this.playerState = new PlayerStateService()
    this.requests = new RequestService({ errorTypes: ERROR_TYPES })
    this.playerGrimoires = new PlayerGrimoireService({ errorTypes: ERROR_TYPES })
    this.roleAssignments = new RoleAssignmentService({ errorTypes: ERROR_TYPES })
    this.lunaticInfo = new LunaticInfoService({ errorTypes: ERROR_TYPES })
    this.roleEngine = new RoleExecutionEngine()
    this.winConditions = new WinConditionService()
    this.recovery = new GameRecoveryService()
    this.serializer = new GameSerializer({
      phases,
      voting: this.voting,
      nightActions: this.nightActions,
      roles,
      scripts: this.scripts
    })
    this.events = new EventBus()
    this.errorTypes = ERROR_TYPES
    this.pruneStaleEmptyGames()
  }

  createError(type, message, meta = {}) {
    return { ok: false, error: { type, message, meta } }
  }

  createSuccess(data = {}) {
    return { ok: true, ...data }
  }

  getCreateGameCooldown(guildId, userId, now = Date.now()) {
    const key = `${guildId}:${userId}`
    const expiresAt = this.createGameCooldowns.get(key) || 0
    if (expiresAt <= now) {
      this.createGameCooldowns.delete(key)
      return null
    }
    return { expiresAt, remainingMs: expiresAt - now }
  }

  setCreateGameCooldown(guildId, userId, durationMs, now = Date.now()) {
    const expiresAt = now + Math.max(0, Number(durationMs) || 0)
    this.createGameCooldowns.set(`${guildId}:${userId}`, expiresAt)
    if (typeof this.saveCreateGameCooldown === 'function') {
      this.saveCreateGameCooldown(guildId, userId, expiresAt)
    }
    return { expiresAt }
  }

  pruneCreateGameCooldowns(now = Date.now()) {
    const cutoff = Number.isFinite(Number(now)) ? Number(now) : Date.now()
    let removed = 0
    for (const [key, expiresAt] of this.createGameCooldowns.entries()) {
      if (Number(expiresAt) > cutoff) continue
      this.createGameCooldowns.delete(key)
      removed += 1
    }
    return removed
  }

  save() {
    this.saveGames(this.gameManager.games)
  }

  getRuntimeState() {
    return createGameLifecycleRuntimeState(this)
  }
}

Object.assign(
  GameLifecycleManager.prototype,
  StateFacade,
  CleanupRecoveryFacade,
  SessionVotingFacade,
  PlayerGrimoireFacade,
  LunaticInfoFacade,
  RoleReminderNightFacade,
  ChannelFacade,
  RequestAdminScriptFacade
)

module.exports = GameLifecycleManager
