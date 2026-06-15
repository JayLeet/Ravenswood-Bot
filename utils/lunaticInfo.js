const {
  formatRoleWithEmoji
} = require('./roleFormatting')

function ensureLunaticInfo(game, playerId, scripts) {
  if (game.roles?.[playerId] !== 'lunatic') return null

  game.lunaticInfo ??= {}
  if (game.lunaticInfo[playerId]?.demonRoleId) {
    applyShownLunaticRole(game, playerId, game.lunaticInfo[playerId].demonRoleId)
    return game.lunaticInfo[playerId]
  }

  const script = scripts.getScript(game.scriptId)
  const demonRoleId = getFirstRoleIdByTeam(script, 'demon') || 'imp'
  const minionCount = countAssignedTeam(game, scripts, 'minion')
  const minionIds = chooseSupposedMinions(game, playerId, minionCount)

  game.lunaticInfo[playerId] = {
    demonRoleId,
    minionIds,
    mode: 'auto'
  }
  applyShownLunaticRole(game, playerId, demonRoleId)
  return game.lunaticInfo[playerId]
}

function resetLunaticInfo(game, playerId, scripts) {
  if (game.roles?.[playerId] !== 'lunatic') return null
  game.lunaticInfo ??= {}
  delete game.lunaticInfo[playerId]
  return ensureLunaticInfo(game, playerId, scripts)
}

function setLunaticDemonRole(game, playerId, demonRoleId, scripts) {
  if (game.roles?.[playerId] !== 'lunatic') return null
  const role = scripts.getRole(game.scriptId, demonRoleId)
  if (!role || role.team !== 'demon') return null

  const info = ensureLunaticInfo(game, playerId, scripts) || {}
  game.lunaticInfo[playerId] = {
    ...info,
    demonRoleId,
    minionIds: Array.isArray(info.minionIds) ? info.minionIds : [],
    mode: 'manual'
  }
  applyShownLunaticRole(game, playerId, demonRoleId)
  return game.lunaticInfo[playerId]
}

function toggleLunaticMinion(game, playerId, minionId, scripts) {
  if (game.roles?.[playerId] !== 'lunatic') return null
  if (!minionId || minionId === playerId || game.users?.[minionId]?.role !== 'player') return null

  const info = ensureLunaticInfo(game, playerId, scripts) || {}
  const selected = new Set(Array.isArray(info.minionIds) ? info.minionIds : [])
  if (selected.has(minionId)) selected.delete(minionId)
  else selected.add(minionId)

  game.lunaticInfo[playerId] = {
    ...info,
    minionIds: [...selected],
    mode: 'manual'
  }
  applyShownLunaticRole(game, playerId, game.lunaticInfo[playerId].demonRoleId)
  return game.lunaticInfo[playerId]
}

function createLunaticFirstNightInfoText(view, playerId, playerLabels = {}) {
  if ((view?.engine?.roles || {})[playerId] !== 'lunatic') return null
  const info = view?.engine?.lunaticInfo?.[playerId]
  if (!info?.demonRoleId) return null

  const lines = [
    `You are the Demon: ${formatRoleWithEmoji(view, info.demonRoleId)}.`
  ]

  lines.push(
    '',
    'These are your Minion(s):',
    info.minionIds?.length
      ? info.minionIds.map(id => `- ${playerLabels[id] || `<@${id}>`}`).join('\n')
      : 'No Minions are in play.'
  )

  return lines.join('\n')
}

function getFirstRoleIdByTeam(script, team) {
  return (script?.roles || []).find(role => role.team === team)?.id || null
}

function countAssignedTeam(game, scripts, team) {
  return Object.values(game.roles || {}).filter(roleId =>
    scripts.getRole(game.scriptId, roleId)?.team === team
  ).length
}

function chooseSupposedMinions(game, playerId, count) {
  if (count <= 0) return []
  return (game.alivePlayers || Object.keys(game.users || {}))
    .filter(id => id !== playerId)
    .slice(0, count)
}

function applyShownLunaticRole(game, playerId, demonRoleId) {
  if (!demonRoleId) return
  game.shownRoles ??= {}
  game.shownRoles[playerId] = demonRoleId
}

module.exports = {
  createLunaticFirstNightInfoText,
  ensureLunaticInfo,
  resetLunaticInfo,
  setLunaticDemonRole,
  toggleLunaticMinion
}
