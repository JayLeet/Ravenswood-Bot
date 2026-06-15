function removeEngineDataForMissingPlayers(manager, game, playerIds) {
  const allowed = new Set(playerIds)

  for (const userId of Object.keys(game.roles || {})) {
    if (!allowed.has(userId)) delete game.roles[userId]
  }

  for (const [userId, roleId] of Object.entries(game.shownRoles || {})) {
    if (!allowed.has(userId) || !manager.scripts.getRole(game.scriptId, roleId)) {
      delete game.shownRoles[userId]
    }
  }

  for (const [userId, entries] of Object.entries(game.roleHistory || {})) {
    if (!allowed.has(userId)) {
      delete game.roleHistory[userId]
      continue
    }

    game.roleHistory[userId] = (Array.isArray(entries) ? entries : [])
      .filter(entry => entry?.roleId && manager.scripts.getRole(game.scriptId, entry.roleId))
    if (!game.roleHistory[userId].length) delete game.roleHistory[userId]
  }

  deleteMissingPlayerKeys(game, [
    'statusEffects',
    'deadVotes',
    'nightChannels',
    'nightVoiceChannels',
    'nightPromptMessages',
    'nightCottageStatusMessages',
    'nightInfoPromptMessages',
    'nightInfoNoticeMessages',
    'nightAreaSlots',
    'pendingRoleInfoUpdates',
    'playerMadeVoiceChannels',
    'roleInfoPromptMessages',
    'demonNotInPlayRoles',
    'roleInfoSent',
    'substituteBriefings'
  ], allowed)

  for (const userId of Object.keys(game.executionShields?.foolSpent || {})) {
    if (!allowed.has(userId)) delete game.executionShields.foolSpent[userId]
  }

  normalizePlayerMadeVoiceAccess(game, allowed)
  normalizePlayerGrimoires(manager, game, allowed)
  normalizeLunaticInfo(manager, game, allowed)
  normalizeNightActions(game, allowed)
}

function deleteMissingPlayerKeys(game, fields, allowed) {
  for (const field of fields) {
    for (const userId of Object.keys(game[field] || {})) {
      if (!allowed.has(userId)) delete game[field][userId]
    }
  }
}

function normalizePlayerMadeVoiceAccess(game, allowed) {
  for (const [ownerId, access] of Object.entries(game.playerMadeVoiceAccess || {})) {
    if (!allowed.has(ownerId)) {
      delete game.playerMadeVoiceAccess[ownerId]
      continue
    }

    access.invitedPlayerIds = [...new Set(access.invitedPlayerIds || [])]
      .filter(userId => allowed.has(userId))
    access.publicRoom = access.publicRoom === true || access.public === true
    delete access.public
  }
}

function normalizePlayerGrimoires(manager, game, allowed) {
  for (const ownerId of Object.keys(game.playerGrimoires || {})) {
    if (!allowed.has(ownerId)) {
      delete game.playerGrimoires[ownerId]
      continue
    }

    for (const [targetId, entry] of Object.entries(game.playerGrimoires[ownerId] || {})) {
      const note = normalizePlayerGrimoireEntry(entry)
      if (!allowed.has(targetId) || (note.roleId && !manager.scripts.getRole(game.scriptId, note.roleId))) {
        delete game.playerGrimoires[ownerId][targetId]
      } else if (note.roleId || note.note) {
        game.playerGrimoires[ownerId][targetId] = note
      } else {
        delete game.playerGrimoires[ownerId][targetId]
      }
    }

    if (!Object.keys(game.playerGrimoires[ownerId] || {}).length) delete game.playerGrimoires[ownerId]
  }
}

function normalizeNightActions(game, allowed) {
  game.nightActions = (game.nightActions || []).filter(action => {
    const actorId = action.actorId || action.playerId
    if (actorId && !allowed.has(actorId)) return false
    if (action.targetId && !allowed.has(action.targetId)) action.targetId = null
    if (Array.isArray(action.targetIds)) {
      action.targetIds = [...new Set(action.targetIds)].filter(userId => allowed.has(userId))
    }
    return true
  })
}

function normalizePlayerGrimoireEntry(entry) {
  if (typeof entry === 'string') return { roleId: entry || null, note: '' }
  return {
    roleId: entry?.roleId || null,
    note: String(entry?.note || '').trim().slice(0, 1000)
  }
}

function normalizeLunaticInfo(manager, game, allowed) {
  for (const [playerId, info] of Object.entries(game.lunaticInfo || {})) {
    const demonRoleId = info?.demonRoleId
    const demonRole = manager.scripts.getRole(game.scriptId, demonRoleId)
    if (!allowed.has(playerId) || game.roles?.[playerId] !== 'lunatic' || demonRole?.team !== 'demon') {
      delete game.lunaticInfo[playerId]
      continue
    }

    game.lunaticInfo[playerId] = {
      demonRoleId,
      minionIds: [...new Set(Array.isArray(info.minionIds) ? info.minionIds : [])]
        .filter(id => allowed.has(id) && id !== playerId),
      mode: info.mode === 'manual' ? 'manual' : 'auto'
    }
  }
}

module.exports = {
  removeEngineDataForMissingPlayers
}
