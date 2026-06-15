const {
  coerceArrayFields,
  coerceBooleanField,
  coerceCountFields,
  coerceNestedCountFields,
  coerceNestedObjectField,
  coerceNullableObjectFields,
  coerceNullableStringFields,
  coerceNumberField,
  coerceObjectFields,
  coerceStringEnumField,
  isPlainObject,
  normalizeRoleCounts,
  warn
} = require('./persistedRecordValidationHelpers')
const {
  isKnownPhase,
  normalizePhaseId
} = require('../game/phases')
const {
  isValidVersion
} = require('../../utils/updateLog')
const {
  ACHIEVEMENT_NUMBER_FIELDS,
  GAME_ARRAY_FIELDS,
  GAME_NULLABLE_OBJECT_FIELDS,
  GAME_OBJECT_FIELDS,
  PENDING_SUMMARY_STATS_FIELDS,
  SERVER_CONFIG_ID_FIELDS,
  VALID_GAME_STATES
} = require('./persistedRecordValidationFields')

function validatePersistedGame(game, { guildId, logger = null } = {}) {
  if (!isPlainObject(game)) {
    warn(logger, 'invalid-game-record', 'Persisted game row is not an object.', { guildId })
    return null
  }

  const next = { ...game }
  if (!next.guildId || next.guildId !== guildId) {
    warn(logger, 'repair-game-guild-id', 'Persisted game guild id was missing or mismatched.', {
      actualGuildId: next.guildId,
      guildId
    })
    next.guildId = guildId
  }

  coerceNumberField(next, 'day', 1, { guildId, logger, recordType: 'game' })
  coerceNumberField(next, 'maxPlayers', 15, { guildId, logger, recordType: 'game' })
  coerceStringEnumField(next, 'state', VALID_GAME_STATES, inferGameState(next), {
    guildId,
    logger,
    recordType: 'game'
  })
  coerceNullableStringFields(next, [
    'executedPlayer',
    'privateConversationCreatorChannelId',
    'storytellerDenChannelId',
    'storytellerId',
    'townsquareChannelId',
    'winner',
    'winReason'
  ], {
    guildId,
    logger,
    recordType: 'game'
  })
  coerceArrayFields(next, GAME_ARRAY_FIELDS, { guildId, logger, recordType: 'game' })
  coerceObjectFields(next, GAME_OBJECT_FIELDS, { guildId, logger, recordType: 'game' })
  coerceNullableObjectFields(next, GAME_NULLABLE_OBJECT_FIELDS, { guildId, logger, recordType: 'game' })
  coerceNestedObjectField(next, 'executionShields', 'foolSpent', { guildId, logger, recordType: 'game' })
  normalizePersistedGamePhase(next, { guildId, logger })
  return next
}

function validatePersistedServerConfig(config, { guildId, logger = null } = {}) {
  if (!isPlainObject(config)) {
    warn(logger, 'invalid-server-config-record', 'Persisted server config row is not an object.', { guildId })
    return null
  }

  const next = { ...config }
  for (const field of SERVER_CONFIG_ID_FIELDS) {
    if (next[field] === undefined || next[field] === null) continue
    if (typeof next[field] === 'string' && next[field]) continue

    warn(logger, 'repair-server-config-id-field', 'Persisted server config id field was not a string.', {
      field,
      guildId
    })
    next[field] = null
  }

  coerceArrayFields(next, ['botUpdateNoticeUserIds'], { guildId, logger, recordType: 'server-config' })
  next.botUpdateNoticeUserIds = [...new Set(next.botUpdateNoticeUserIds
    .map(id => String(id || '').trim())
    .filter(Boolean))]
  coerceNullableStringFields(next, ['firstJoinSetupNoticeSentAt'], { guildId, logger, recordType: 'server-config' })
  coerceBooleanField(next, 'privateAccess', false, { guildId, logger, recordType: 'server-config' })
  if (next.lastBotUpdateNoticeVersion !== undefined && next.lastBotUpdateNoticeVersion !== null) {
    const version = String(next.lastBotUpdateNoticeVersion).trim()
    if (typeof next.lastBotUpdateNoticeVersion !== 'string' || !isValidVersion(version)) {
      warn(logger, 'repair-server-config-version-field', 'Persisted update notice version was malformed.', { guildId })
      next.lastBotUpdateNoticeVersion = null
    } else {
      next.lastBotUpdateNoticeVersion = version
    }
  }

  return next
}

function inferGameState(game) {
  if (game.endedAt) return 'ended'
  if (game.startedAt) return 'in-game'
  return 'lobby'
}

function normalizePersistedGamePhase(game, { guildId, logger }) {
  if (game.phase === undefined || game.phase === null || game.phase === '') {
    game.phase = getDefaultPhaseForState(game.state)
    return
  }

  const normalized = normalizePhaseId(game.phase)
  if (isKnownPhase(normalized)) {
    game.phase = normalized
    return
  }

  warn(logger, 'repair-game-phase-field', 'Persisted game phase was malformed.', {
    guildId,
    phase: game.phase
  })
  game.phase = getDefaultPhaseForState(game.state)
}

function getDefaultPhaseForState(state) {
  if (state === 'ended') return null
  if (state === 'in-game') return 'night'
  return 'lobby'
}

function validatePendingGameSummary(summary, { guildId, logger = null } = {}) {
  if (!isPlainObject(summary)) {
    warn(logger, 'invalid-pending-summary-record', 'Persisted pending game summary is not an object.', { guildId })
    return null
  }

  if (!summary.id) {
    warn(logger, 'invalid-pending-summary-id', 'Persisted pending game summary is missing an id.', { guildId })
    return null
  }

  const next = { ...summary }
  if (!next.guildId || next.guildId !== guildId) {
    warn(logger, 'repair-pending-summary-guild-id', 'Pending game summary guild id was missing or mismatched.', {
      actualGuildId: next.guildId,
      guildId
    })
    next.guildId = guildId
  }

  coerceArrayFields(next, ['alivePlayers', 'deadPlayers', 'executionHistory', 'nominations', 'players', 'reminders', 'spectators'], {
    guildId,
    logger,
    recordType: 'pending-summary'
  })
  coerceObjectFields(next, ['deadVotes', 'nightVoiceChannels', 'roleCategories', 'roles', 'stats'], {
    guildId,
    logger,
    recordType: 'pending-summary'
  })
  coerceNestedCountFields(next, 'stats', PENDING_SUMMARY_STATS_FIELDS, {
    guildId,
    logger,
    recordType: 'pending-summary'
  })
  return next
}

function validateAchievementStats(stats, { guildId, logger = null, userId } = {}) {
  if (!isPlainObject(stats)) {
    warn(logger, 'invalid-achievement-stats-record', 'Persisted achievement stats row is not an object.', {
      guildId,
      userId
    })
    return null
  }

  const next = { ...stats }
  if (!next.userId || next.userId !== userId) {
    warn(logger, 'repair-achievement-stats-user-id', 'Achievement stats user id was missing or mismatched.', {
      actualUserId: next.userId,
      guildId,
      userId
    })
    next.userId = userId
  }
  coerceCountFields(next, ACHIEVEMENT_NUMBER_FIELDS, { guildId, logger, recordType: 'achievement-stats' })
  coerceObjectFields(next, ['roleCounts'], { guildId, logger, recordType: 'achievement-stats' })
  normalizeRoleCounts(next, { guildId, logger })
  if (next.favoriteRole !== undefined && next.favoriteRole !== null && typeof next.favoriteRole !== 'string') {
    warn(logger, 'repair-achievement-favorite-role', 'Achievement favorite role was not a string.', {
      guildId,
      userId
    })
    next.favoriteRole = null
  }
  return next
}

function validateCooldownRow(row, { logger = null } = {}) {
  const guildId = row?.guild_id
  const userId = row?.user_id
  const expiresAt = Number(row?.expires_at)

  if (!guildId || !userId || !Number.isFinite(expiresAt)) {
    warn(logger, 'invalid-create-game-cooldown-record', 'Persisted create-game cooldown row is malformed.', {
      guildId,
      userId
    })
    return null
  }

  return { expiresAt, guildId, userId }
}

module.exports = {
  validateAchievementStats,
  validateCooldownRow,
  validatePendingGameSummary,
  validatePersistedGame,
  validatePersistedServerConfig
}
