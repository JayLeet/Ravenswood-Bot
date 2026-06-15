const GameLifecycleManager = require('../GameLifecycleManager')
const GameManager = require('../GameManager')
const {
  assertPhaseDefinitions,
  assertPersistedRecordValidation,
  assertRuntimeMaintenanceResilience
} = require('./startupSelfCheckInvariants')

const SELF_CHECK_GUILD_ID = 'startup-self-check'

async function runStartupSelfCheck({ enabled = isStartupSelfCheckEnabled() } = {}) {
  if (!enabled) return { ok: true, skipped: true }

  const games = new Map([[SELF_CHECK_GUILD_ID, createRecoveryFixture()]])
  const lifecycle = new GameLifecycleManager({
    gameManager: new GameManager(games),
    saveGames: () => {}
  })

  const game = games.get(SELF_CHECK_GUILD_ID)
  const summary = await lifecycle.recovery.recoverGame(lifecycle, game)
  const view = lifecycle.serializeGame(game, { guildId: SELF_CHECK_GUILD_ID })
  assertSelfCheck(summary.changed, 'messy recovery fixture did not report repairs')
  assertSelfCheck(game.phase === 'nominations', 'valid nominations phase was not preserved')
  assertSelfCheck(!game.roles.missing, 'missing-player role survived recovery')
  assertSelfCheck(!game.lunaticInfo.missing, 'missing-player Lunatic info survived recovery')
  assertSelfCheck(!game.lunaticInfo.p5, 'invalid Lunatic info survived recovery')
  assertSelfCheck(!game.shownRoles.missing, 'missing-player shown role survived recovery')
  assertSelfCheck(!game.shownRoles.p4, 'invalid shown role survived recovery')
  assertSelfCheck(Array.isArray(game.roleHistory.p2), 'role history entries did not survive recovery')
  assertSelfCheck(game.roleHistory.p2[0]?.roleId === 'spy', 'valid role history entry did not survive recovery')
  assertSelfCheck(!game.roleHistory.missing, 'missing-player role history survived recovery')
  assertSelfCheck(game.pendingEndReveal.revealedPlayers.length === 1, 'pending reveal kept invalid player ids')
  assertSelfCheck(game.pendingEndReveal.status === 'pending', 'pending reveal status did not default')
  assertSelfCheck(game.pendingEndReveal.forcedWinner === null, 'pending reveal kept invalid forced winner')
  assertSelfCheck(game.pendingEndReveal.winner === null, 'pending reveal kept invalid winner')
  assertSelfCheck(game.pendingEndReveal.requestedBy === null, 'pending reveal kept missing requester')
  assertSelfCheck(game.pendingEndReveal.requestedAt === 0, 'pending reveal kept invalid request timestamp')
  assertSelfCheck(game.pendingEndReveal.day === 2, 'pending reveal day did not normalize')
  assertSelfCheck(game.pendingEndReveal.phase === 'nominations', 'pending reveal phase did not normalize')
  assertSelfCheck(game.pendingEndReveal.state === 'in-game', 'pending reveal state did not normalize')
  assertSelfCheck(game.pendingEndReveal.skipPlayerReveal === false, 'pending reveal skip flag did not normalize')
  assertSelfCheck(game.pendingNightDeaths.length === 1, 'pending night deaths kept invalid player ids')
  assertSelfCheck(game.pendingManualImpReplacement.candidates.join(',') === 'p2,p3', 'manual Imp candidates did not normalize')
  assertSelfCheck(game.pendingManualImpReplacement.deadDemonId === 'p1', 'manual Imp dead Demon id did not migrate')
  assertSelfCheck(game.playerMadeVoiceAccess.p4.publicRoom === true, 'player-made voice public flag did not migrate')
  assertSelfCheck(game.playerMadeVoiceAccess.p4.invitedPlayerIds.join(',') === 'p2', 'player-made voice access kept invalid invites')
  assertSelfCheck(!game.playerMadeVoiceAccess.missing, 'missing-player voice access survived recovery')
  assertSelfCheck(game.nominationRequests.length === 1, 'invalid nomination request survived recovery')
  assertSelfCheck(view.engine.nominationRequests.length === 1, 'serialized view lost pending nomination request')

  const substituted = lifecycle.admin.substitutePlayer(lifecycle, game, 'p4', { id: 'p6' })
  assertSelfCheck(substituted.ok, 'substitution simulation failed')
  assertSelfCheck(game.users.p6?.role === 'player', 'substitute user was not moved')
  assertSelfCheck(game.playerMadeVoiceAccess.p6?.publicRoom === true, 'substitute voice access was not moved')
  assertSelfCheck(game.shownRoles.p6 === undefined, 'invalid shown role reappeared after substitution')
  assertSelfCheck(game.paused === null, 'substitution did not clear paused state')
  assertSelfCheck(game.replacementSlot === null, 'substitution did not clear replacement slot')
  assertPhaseDefinitions(assertSelfCheck)
  assertPersistedRecordValidation(assertSelfCheck)
  assertRuntimeMaintenanceResilience(assertSelfCheck)

  return {
    ok: true,
    repaired: summary.changed === true
  }
}

function createRecoveryFixture() {
  return {
    guildId: SELF_CHECK_GUILD_ID,
    storytellerId: 'st',
    state: 'in-game',
    phase: 'nominations',
    phaseStartedAt: Date.now(),
    phaseHistory: [],
    day: 2,
    gameMode: 'discord-only',
    scriptId: 'trouble-brewing',
    script: 'Trouble Brewing',
    winner: null,
    winReason: null,
    pendingWin: null,
    pendingEndReveal: {
      forcedWinner: 'not-a-team',
      id: 'self-check-reveal',
      requestedAt: 'invalid',
      requestedBy: 'missing',
      revealedPlayers: ['p1', 'missing'],
      skipPlayerReveal: 'yes',
      winner: 'none'
    },
    pendingManualImpReplacement: {
      candidates: ['p2', 'missing', 'p3'],
      createdAt: 1,
      createdBy: 'st',
      deadPlayerId: 'p1',
      id: 'self-check-imp',
      roleId: 'imp'
    },
    paused: {
      playerId: 'p4',
      reason: 'player_left',
      startedAt: 1
    },
    replacementSlot: {
      createdAt: 1,
      oldPlayerId: 'p4',
      reason: 'player_left'
    },
    mastermindFinalDay: null,
    maxPlayers: 5,
    createdAt: 1,
    startedAt: 2,
    users: {
      st: { role: 'storyteller' },
      p1: { role: 'player' },
      p2: { role: 'player' },
      p3: { role: 'player' },
      p4: { role: 'player' },
      p5: { role: 'player' }
    },
    requests: [],
    messages: [{ channelId: 'storyteller-channel', messageId: 'message-1' }],
    alivePlayers: ['p2', 'p3', 'p4', 'p5'],
    deadPlayers: ['p1'],
    nominations: [{
      createdAt: 1,
      day: 2,
      guildId: SELF_CHECK_GUILD_ID,
      id: 'nomination-1',
      nomineeId: 'p3',
      nominatorId: 'p2',
      secondedBy: null,
      status: 'pending_second'
    }],
    nominationRequests: [
      createNominationRequest('request-1', 'p2', 'p3'),
      createNominationRequest('request-2', 'missing', 'p3')
    ],
    demonNotInPlayRoles: { p1: ['imp'], missing: ['baron'] },
    zombuulDeaths: {},
    executionHistory: [{ day: 1, playerId: 'p1' }, { day: 1, playerId: 'missing' }],
    executedPlayer: null,
    executionCandidate: null,
    nightActions: [{
      actorId: 'p2',
      day: 2,
      guildId: SELF_CHECK_GUILD_ID,
      id: 'night-action-1',
      phase: 'night',
      roleId: 'poisoner',
      status: 'submitted',
      targetId: 'missing',
      targetIds: ['p4', 'missing']
    }],
    pendingNightDeaths: [
      { createdAt: 1, playerId: 'p1', source: 'self-check' },
      { createdAt: 1, playerId: 'missing', source: 'self-check' }
    ],
    nightChannels: { p2: 'night-text-2', missing: 'night-text-missing' },
    nightInfoPromptMessages: { p2: { role_change_info: { channelId: 'night-text-2', messageId: 'role-change-message-2' } }, missing: {} },
    nightPromptMessages: { p2: { channelId: 'night-text-2', messageId: 'night-message-2' }, missing: {} },
    nightVoiceChannels: { p2: 'night-voice-2', missing: 'night-voice-missing' },
    pendingRoleInfoUpdates: { p2: 1, missing: 1 },
    roleInfoPromptMessages: { p2: { channelId: 'night-text-2', messageId: 'role-message-2' }, missing: {} },
    roleInfoSent: { p2: true, missing: true },
    playerGrimoires: {
      p2: { p3: { roleId: 'baron', note: 'valid' }, missing: 'imp' },
      missing: { p2: 'spy' }
    },
    storytellerDenChannelId: 'storyteller-den',
    townsquareChannelId: 'townsquare',
    privateConversationCreatorChannelId: 'create-private',
    playerMadeVoiceChannels: { p4: 'voice-4', missing: 'voice-missing' },
    playerMadeVoiceAccess: {
      p4: { invitedPlayerIds: ['p2', 'missing'], public: true },
      missing: { invitedPlayerIds: ['p2'] }
    },
    publicDaySideChannelIds: {},
    voteClockhandSpeedMs: 900,
    votes: [{ nominationId: 'nomination-1', userId: 'p2', value: true }],
    deadVotes: { p1: true, missing: true },
    roles: {
      missing: 'imp',
      p1: 'imp',
      p2: 'poisoner',
      p3: 'baron',
      p4: 'empath',
      p5: 'washerwoman'
    },
    shownRoles: {
      missing: 'chef',
      p4: 'not_a_role',
      p5: 'chef'
    },
    lunaticInfo: {
      missing: { demonRoleId: 'imp', minionIds: ['p2'], mode: 'manual' },
      p5: { demonRoleId: 'not_a_role', minionIds: ['p2', 'missing'], mode: 'manual' }
    },
    roleHistory: {
      missing: [{ changedAt: 1, roleId: 'imp' }],
      p2: [{ changedAt: 1, roleId: 'spy', source: 'self-check' }]
    },
    roleCategories: {},
    reminders: [{ id: 'reminder-1', playerId: 'p2', status: 'active', type: 'poisoned' }],
    statusEffects: { missing: { poisoned: true }, p2: { poisoned: true } }
  }
}

function createNominationRequest(id, nominatorId, nomineeId) {
  return {
    createdAt: 1,
    day: 2,
    guildId: SELF_CHECK_GUILD_ID,
    id,
    nominationId: null,
    nomineeId,
    nominatorId,
    resolvedAt: null,
    resolvedBy: null,
    status: 'pending'
  }
}

function assertSelfCheck(condition, message) {
  if (condition) return
  throw new Error(`Startup self-check failed: ${message}`)
}

function isStartupSelfCheckEnabled() {
  return !/^(0|false|no|off)$/i.test(String(process.env.BOTC_STARTUP_SELF_CHECK || '').trim())
}

module.exports = {
  runStartupSelfCheck
}
