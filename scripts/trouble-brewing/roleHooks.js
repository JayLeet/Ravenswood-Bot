const info = require('./roleInfo')
const {
  assignRoleWithHistory
} = require('../../systems/game/roles/roleHistory')

function acknowledgeInfo(summary) {
  return async ({ game, actorId, playerId }) => ({
    summary: info.withInfoCaution(game, actorId || playerId, summary)
  })
}

async function chefInfo({ manager, game, actorId, playerId }) {
  const count = info.countEvilPairs(manager, game)
  const actor = actorId || playerId
  return {
    summary: info.withInfoCaution(game, actor, `Chef number: ${count}.`),
    suggestedInfo: createDeliverySuggestion(game, actor, `Your Chef number is ${count}.`),
    count
  }
}

async function empathInfo({ manager, game, actorId, playerId }) {
  const actor = actorId || playerId
  const count = info.countEvilLivingNeighbors(manager, game, actor)
  return {
    summary: info.withInfoCaution(game, actor, `Empath number: ${count}.`),
    suggestedInfo: createDeliverySuggestion(game, actor, `Your Empath number is ${count}.`),
    count
  }
}

async function fortuneTellerInfo({ manager, game, action, targetId, actorId, playerId }) {
  const targets = info.getTargetIds(action, targetId)
  const yes = targets.some(id => info.isDemonOrRedHerring(manager, game, id))
  const actor = actorId || playerId
  const suggestedInfo = `You learn ${yes ? 'yes' : 'no'}.`

  return {
    summary: info.withInfoCaution(game, actor, `Fortune Teller result: ${yes ? 'yes' : 'no'}.`),
    suggestedInfo: createDeliverySuggestion(game, actor, suggestedInfo),
    targetIds: targets,
    result: yes ? 'yes' : 'no'
  }
}

async function revealTargetRole({ manager, game, action, targetId, actorId, playerId }) {
  const [target] = info.getTargetIds(action, targetId)
  if (!target) return { summary: 'No target selected.' }

  const actor = actorId || playerId
  const roleName = info.getRoleName(manager, game, target)
  return {
    summary: info.withInfoCaution(game, actor, `Learned ${roleName}.`),
    suggestedInfo: createDeliverySuggestion(game, actor, `You learn ${roleName}.`),
    targetId: target,
    roleId: game.roles?.[target] || null
  }
}

async function undertakerInfo({ manager, game, actorId, playerId }) {
  const executed = game.executedPlayer
  if (!executed) return { summary: 'No execution was recorded today.' }

  const actor = actorId || playerId
  const roleName = info.getRoleName(manager, game, executed)
  return {
    summary: info.withInfoCaution(game, actor, `Undertaker learned ${roleName}.`),
    suggestedInfo: createDeliverySuggestion(game, actor, `You learn the executed player was ${roleName}.`),
    targetId: executed,
    roleId: game.roles?.[executed] || null
  }
}

async function ravenkeeperWake(context) {
  const { manager, game, playerId } = context
  if (game.phase !== 'night' || !(game.deadPlayers || []).includes(playerId)) return null
  if (hasOpenRoleAction(game, playerId, 'ravenkeeper')) return null

  const action = manager.nightActions.createTargetAction(game, {
    guildId: game.guildId,
    playerId,
    roleId: 'ravenkeeper',
    createdBy: game.storytellerId,
    source: 'role_engine',
    autoPrompt: true,
    behaviorId: 'ravenkeeper',
    roleName: 'Ravenkeeper',
    prompt: 'Choose a player to learn their character.',
    targetType: 'player',
    allowDeadActor: true
  })

  await manager.emit('NIGHT_ACTION_CREATED', {
    game,
    member: null,
    playerId,
    action,
    source: 'role_engine',
    reason: 'ravenkeeper-death'
  })

  return { summary: 'Ravenkeeper woke after dying at night.', actionId: action.id }
}

async function scarletWomanCatch(context) {
  const { manager, game, playerId, deadRole, deadRoleId, aliveBeforeDeath } = context
  const demonRoleId = deadRoleId || game.roles?.[context.demonId || playerId]
  const demonRole = deadRole || manager.scripts.getRole(game.scriptId, demonRoleId)
  if (demonRole?.team !== 'demon') return null
  if ((aliveBeforeDeath || 0) < 5) return null
  if (!(game.alivePlayers || []).includes(playerId)) return null
  if (!isSoberHealthy(game, playerId)) return null

  assignRoleWithHistory(game, playerId, demonRoleId, 'scarlet_woman')

  await manager.emit('PLAYER_ROLE_ASSIGNED', {
    game,
    member: null,
    playerId,
    roleId: demonRoleId,
    source: 'scarlet_woman'
  })

  return {
    summary: `The Scarlet Woman became the ${demonRole?.name || 'Demon'}.`,
    playerId,
    roleId: demonRoleId
  }
}

async function saintExecution({ game }) {
  game.pendingWin = {
    winner: 'evil',
    reason: 'The Saint was executed'
  }

  return {
    summary: 'The Saint was executed, so evil wins.',
    win: game.pendingWin
  }
}

async function mayorNoExecutionWin({ game, playerId, vote }) {
  if (!(game.alivePlayers || []).includes(playerId)) return null
  if (vote.finalizingDay === false) return null

  const executed = vote.executed ?? vote.yesVotes >= vote.threshold
  if (executed || (game.alivePlayers || []).length !== 3) return null

  game.pendingWin = {
    winner: 'good',
    reason: 'The Mayor survived with three players alive and no execution'
  }

  return {
    executed: false,
    pendingWin: game.pendingWin
  }
}

function clearStatusOnPhase(status, phaseName) {
  return async ({ manager, game, phase }) => {
    if (phase !== phaseName) return null

    let cleared = 0
    for (const playerId of manager.getPlayerIds(game)) {
      if (!game.statusEffects?.[playerId]?.[status]) continue
      manager.reminders.setPlayerStatus(game, playerId, status, false, game.storytellerId)
      cleared += 1
    }

    return cleared ? { summary: `Cleared ${status} from ${cleared} player(s).` } : null
  }
}

function hasOpenRoleAction(game, playerId, roleId) {
  return (game.nightActions || []).some(action =>
    action.source === 'role_engine' &&
    action.playerId === playerId &&
    action.roleId === roleId &&
    action.day === game.day &&
    action.phase === game.phase &&
    action.status !== 'cancelled'
  )
}

function hasExecutedPlayer({ game }) {
  return !!game.executedPlayer
}

function createDeliverySuggestion(game, actorId, text) {
  const effects = game.statusEffects?.[actorId] || {}
  if (!effects.poisoned && !effects.drunk) return text

  return 'Storyteller override needed: this player is poisoned or drunk. Replace this text before sending.'
}

function isSoberHealthy(game, playerId) {
  const effects = game.statusEffects?.[playerId] || {}
  return effects.drunk !== true && effects.poisoned !== true
}

module.exports = {
  acknowledgeInfo,
  chefInfo,
  clearStatusOnPhase,
  empathInfo,
  fortuneTellerInfo,
  hasExecutedPlayer,
  mayorNoExecutionWin,
  ravenkeeperWake,
  revealTargetRole,
  saintExecution,
  scarletWomanCatch,
  undertakerInfo
}
