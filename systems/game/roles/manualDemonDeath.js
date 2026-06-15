const {
  assignRoleWithHistory
} = require('./roleHistory')

const IMP_ROLE_ID = 'imp'
const SCARLET_WOMAN_ROLE_ID = 'scarlet_woman'

async function ensureManualDemonReplacement(manager, game, deadPlayerId, deadRoleId, context = {}) {
  const deadRole = manager.scripts.getRole(game.scriptId, deadRoleId)
  if (deadRole?.team !== 'demon') return null
  if (hasLivingDemon(manager, game)) return null
  if (deadRoleId !== IMP_ROLE_ID) return null

  const scarletWoman = chooseAutomaticScarletWomanReplacement(manager, game, context.aliveBeforeDeath)
  if (scarletWoman) {
    return assignImpReplacement(manager, game, scarletWoman, context.member, 'manual_imp_death')
  }

  const candidates = getLivingMinions(manager, game)
  if (!candidates.length) return null

  const pendingReplacement = createPendingManualImpReplacement(game, deadPlayerId, candidates, context.member)
  return {
    pendingChoice: true,
    candidates,
    pendingReplacement,
    summary: 'The Storyteller must choose which living Minion becomes the Imp.'
  }
}

async function assignPendingManualImpReplacement(manager, game, playerId, requestId, member = null) {
  const pending = game.pendingManualImpReplacement || null
  if (!pending || pending.id !== requestId) return null
  if (!(pending.candidates || []).includes(playerId)) return null
  if (!getLivingMinions(manager, game).includes(playerId)) return null

  game.pendingManualImpReplacement = null
  return assignImpReplacement(manager, game, playerId, member, 'manual_imp_choice')
}

function chooseAutomaticScarletWomanReplacement(manager, game, aliveBeforeDeath = 0) {
  if (Number(aliveBeforeDeath || 0) < 5) return null
  return getLivingMinions(manager, game).find(playerId =>
    game.roles?.[playerId] === SCARLET_WOMAN_ROLE_ID && isSoberHealthy(game, playerId)
  ) || null
}

async function assignImpReplacement(manager, game, playerId, member = null, source = 'manual_imp_death') {
  assignRoleWithHistory(game, playerId, IMP_ROLE_ID, source)

  await manager.emit('PLAYER_ROLE_ASSIGNED', {
    game,
    member: member || null,
    playerId,
    roleId: IMP_ROLE_ID,
    source
  })

  return {
    playerId,
    roleId: IMP_ROLE_ID,
    summary: 'A living Minion became the Imp after the Imp died.'
  }
}

function createPendingManualImpReplacement(game, deadPlayerId, candidates, member = null) {
  const pending = {
    id: `${Date.now()}-${member?.id || game.storytellerId || 'storyteller'}`,
    candidates: [...candidates],
    deadDemonId: deadPlayerId,
    requestedAt: Date.now(),
    requestedBy: member?.id || game.storytellerId || null,
    roleId: IMP_ROLE_ID
  }
  game.pendingManualImpReplacement = pending
  return pending
}

function getLivingMinions(manager, game) {
  return (game.alivePlayers || []).filter(playerId => {
    const role = manager.scripts.getRole(game.scriptId, game.roles?.[playerId])
    return role?.team === 'minion'
  })
}

function hasLivingDemon(manager, game) {
  return (game.alivePlayers || []).some(playerId => {
    const role = manager.scripts.getRole(game.scriptId, game.roles?.[playerId])
    return role?.team === 'demon'
  })
}

function isSoberHealthy(game, playerId) {
  const effects = game.statusEffects?.[playerId] || {}
  return effects.drunk !== true && effects.poisoned !== true
}

module.exports = {
  assignPendingManualImpReplacement,
  chooseAutomaticScarletWomanReplacement,
  ensureManualDemonReplacement,
  getLivingMinions,
  hasLivingDemon,
  isSoberHealthy
}
