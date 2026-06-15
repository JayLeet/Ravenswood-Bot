const {
  registerRuntimeMaintenanceTask,
  runRuntimeMaintenance
} = require('../../utils/runtimeMaintenance')
const {
  validateAchievementStats,
  validateCooldownRow,
  validatePendingGameSummary,
  validatePersistedGame,
  validatePersistedServerConfig
} = require('../persistence/persistedRecordValidation')
const phases = require('../game/phases')

const SELF_CHECK_GUILD_ID = 'startup-self-check'
const SILENT_LOGGER = Object.freeze({ warn: () => {} })

function assertPersistedRecordValidation(assertSelfCheck) {
  const game = validatePersistedGame({
    guildId: 'wrong-guild',
    lunaticInfo: [],
    maxPlayers: 'bad',
    messages: {},
    nightCottageStatusMessages: [],
    nightInfoPromptMessages: [],
    nightInfoNoticeMessages: [],
    phase: 'not-a-phase',
    privateConversationCreatorChannelId: {},
    requests: {},
    startedAt: 1,
    state: 'corrupted',
    executionCandidate: [],
    executedPlayer: 3,
    storytellerDenChannelId: [],
    storytellerId: {},
    townsquareChannelId: 10,
    winReason: [],
    winner: 3,
    users: []
  }, { guildId: SELF_CHECK_GUILD_ID, logger: SILENT_LOGGER })
  assertSelfCheck(game.guildId === SELF_CHECK_GUILD_ID, 'persisted game guild id did not repair')
  assertSelfCheck(game.lunaticInfo && !Array.isArray(game.lunaticInfo), 'persisted game Lunatic info did not normalize to object')
  assertSelfCheck(game.maxPlayers === 15, 'persisted game maxPlayers did not default')
  assertSelfCheck(game.nightCottageStatusMessages && !Array.isArray(game.nightCottageStatusMessages), 'persisted game cottage status refs did not normalize to object')
  assertSelfCheck(game.nightInfoPromptMessages && !Array.isArray(game.nightInfoPromptMessages), 'persisted game night-info prompt refs did not normalize to object')
  assertSelfCheck(game.nightInfoNoticeMessages && !Array.isArray(game.nightInfoNoticeMessages), 'persisted game night-info notice refs did not normalize to object')
  assertSelfCheck(game.phase === 'night', 'persisted game malformed phase did not default')
  assertSelfCheck(game.privateConversationCreatorChannelId === null, 'persisted game private conversation creator id did not clear')
  assertSelfCheck(Array.isArray(game.requests), 'persisted game requests did not normalize to array')
  assertSelfCheck(game.state === 'in-game', 'persisted game invalid state did not infer from startedAt')
  assertSelfCheck(game.executionCandidate === null, 'persisted game invalid execution candidate did not clear')
  assertSelfCheck(game.executedPlayer === null, 'persisted game invalid executed player did not clear')
  assertSelfCheck(game.storytellerDenChannelId === null, 'persisted game storyteller den id did not clear')
  assertSelfCheck(game.storytellerId === null, 'persisted game invalid storyteller id did not clear')
  assertSelfCheck(game.townsquareChannelId === null, 'persisted game townsquare id did not clear')
  assertSelfCheck(game.users && !Array.isArray(game.users), 'persisted game users did not normalize to object')
  assertSelfCheck(game.winReason === null, 'persisted game invalid win reason did not clear')
  assertSelfCheck(game.winner === null, 'persisted game invalid winner did not clear')

  const config = validatePersistedServerConfig({
    botUpdateNoticeUserIds: ['user-1', 2, '', 'user-1'],
    firstJoinSetupNoticeSentAt: 123,
    gameChannelId: 123,
    lastBotUpdateNoticeVersion: 'invalid-version',
    privateAccess: 'yes'
  }, { guildId: SELF_CHECK_GUILD_ID, logger: SILENT_LOGGER })
  assertSelfCheck(config.gameChannelId === null, 'persisted config invalid channel id did not clear')
  assertSelfCheck(config.lastBotUpdateNoticeVersion === null, 'persisted config invalid update version did not clear')
  assertSelfCheck(config.privateAccess === false, 'persisted config privateAccess did not default')
  assertSelfCheck(config.botUpdateNoticeUserIds.join(',') === 'user-1,2', 'persisted config update notice users did not normalize')
  assertSelfCheck(config.firstJoinSetupNoticeSentAt === null, 'persisted config invalid first-join setup notice timestamp did not clear')

  const summary = validatePendingGameSummary({
    guildId: 'wrong-guild',
    id: 'summary-1',
    players: {},
    roles: [],
    stats: { playerCount: '2', reminderCount: 'bad' }
  }, { guildId: SELF_CHECK_GUILD_ID, logger: SILENT_LOGGER })
  assertSelfCheck(summary.guildId === SELF_CHECK_GUILD_ID, 'pending summary guild id did not repair')
  assertSelfCheck(Array.isArray(summary.players), 'pending summary players did not normalize to array')
  assertSelfCheck(summary.roles && !Array.isArray(summary.roles), 'pending summary roles did not normalize to object')
  assertSelfCheck(summary.stats.playerCount === 2, 'pending summary stat count did not normalize')
  assertSelfCheck(summary.stats.reminderCount === 0, 'pending summary invalid stat did not repair')

  const stats = validateAchievementStats({
    gamesPlayed: 'bad',
    roleCounts: { imp: '2', '': 1, empath: -1 }
  }, {
    guildId: SELF_CHECK_GUILD_ID,
    logger: SILENT_LOGGER,
    userId: 'p1'
  })
  assertSelfCheck(stats.userId === 'p1', 'achievement stats user id did not repair')
  assertSelfCheck(stats.gamesPlayed === 0, 'achievement stats invalid count did not repair')
  assertSelfCheck(stats.roleCounts.imp === 2, 'achievement stats role count did not normalize')
  assertSelfCheck(!stats.roleCounts.empath, 'achievement stats invalid role count did not clear')

  const cooldown = validateCooldownRow({
    expires_at: '123',
    guild_id: SELF_CHECK_GUILD_ID,
    user_id: 'p1'
  }, { logger: SILENT_LOGGER })
  assertSelfCheck(cooldown.expiresAt === 123, 'cooldown expiry did not normalize')
}

function assertRuntimeMaintenanceResilience(assertSelfCheck) {
  const taskName = 'startupSelfCheckMaintenance'
  const unregisterOldTask = registerRuntimeMaintenanceTask(taskName, () => ({ oldTask: true }))
  const unregisterCurrentTask = registerRuntimeMaintenanceTask(taskName, () => {
    throw new Error('simulated maintenance task failure')
  })

  unregisterOldTask()
  const failedResult = runRuntimeMaintenance({ logger: SILENT_LOGGER, now: 123 })
  unregisterCurrentTask()
  const cleanedResult = runRuntimeMaintenance({ logger: SILENT_LOGGER, now: 123 })

  assertSelfCheck(failedResult.registeredTasks.includes(taskName), 'old maintenance unregister removed newer task')
  assertSelfCheck(failedResult[taskName]?.failed === true, 'maintenance task failure was not isolated')
  assertSelfCheck(failedResult.errors?.some(error => error.task === taskName), 'maintenance task error was not reported')
  assertSelfCheck(!cleanedResult.registeredTasks.includes(taskName), 'maintenance task did not unregister')
}

function assertPhaseDefinitions(assertSelfCheck) {
  const issues = phases.validatePhaseDefinitions()
  assertSelfCheck(issues.length === 0, `phase definitions failed validation: ${issues.join('; ')}`)
}

module.exports = {
  assertPhaseDefinitions,
  assertPersistedRecordValidation,
  assertRuntimeMaintenanceResilience
}
