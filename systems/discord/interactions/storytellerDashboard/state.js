const REFRESH_EVENTS = [
  'ADMIN_USER_REMOVED',
  'GAME_CREATED',
  'GAME_STARTED',
  'LUNATIC_INFO_CHANGED',
  'NIGHT_ACTION_CREATED',
  'NIGHT_ACTION_RESOLVED',
  'NIGHT_ACTION_SUBMITTED',
  'NOMINATION_CANCELLED',
  'NOMINATION_CREATED',
  'NOMINATION_SECONDED',
  'PHASE_CHANGED',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_LIFE_STATE_CHANGED',
  'PLAYER_ROLE_ASSIGNED',
  'PLAYER_SPECTATED',
  'PLAYER_STATUS_CHANGED',
  'REMINDER_CHANGED',
  'SCRIPT_CHANGED',
  'STORYTELLER_ACTION_RECORDED',
  'STORYTELLER_CHANGED',
  'VOTE_CAST',
  'VOTE_COUNTED',
  'VOTE_OPENED',
  'VOTE_PAUSED',
  'VOTE_RESOLVED'
]
const DASHBOARD_STATE_TTL_MS = 2 * 60 * 60 * 1000
const {
  createBotLogger
} = require('../../../../utils/logger')

function createStorytellerDashboardState({
  client,
  gameLifecycle,
  serverConfigs,
  saveServerConfigs,
  refreshDashboard,
  clearDashboardRender = null
}) {
  const selections = new Map()
  const nominationDrafts = new Map()
  const randomRoleDrafts = new Map()
  const refreshTimers = new Map()
  const log = createBotLogger({ subsystem: 'StorytellerDashboardState' })

  function registerRefresh() {
    for (const event of REFRESH_EVENTS) {
      gameLifecycle.events.on(event, ({ game }) => {
        if (game?.guildId) scheduleRefresh(game.guildId)
      })
    }

    gameLifecycle.events.on('GAME_ENDED', ({ game }) => {
      if (game?.guildId) clear(game.guildId)
    })
  }

  function scheduleRefresh(guildId) {
    const existing = refreshTimers.get(guildId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      refreshTimers.delete(guildId)
      await refreshDashboard(client, guildId).catch(err => {
        log.recoverable('refresh-dashboard', err, { guildId })
      })
    }, 500)

    refreshTimers.set(guildId, timer)
  }

  function clear(guildId) {
    const timer = refreshTimers.get(guildId)
    if (timer) clearTimeout(timer)
    refreshTimers.delete(guildId)

    if (typeof clearDashboardRender === 'function') clearDashboardRender(guildId)

    for (const key of selections.keys()) {
      if (key.startsWith(`${guildId}:`)) selections.delete(key)
    }
    for (const key of randomRoleDrafts.keys()) {
      if (key.startsWith(`${guildId}:`)) randomRoleDrafts.delete(key)
    }
    for (const key of nominationDrafts.keys()) {
      if (key.startsWith(`${guildId}:`)) nominationDrafts.delete(key)
    }

    const serverConfig = serverConfigs.get(guildId)
    if (!serverConfig?.storytellerDashboardMessageId) return

    delete serverConfig.storytellerDashboardMessageId
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
  }

  function getSelectedPlayer(guildId, userId) {
    if (!guildId || !userId) return null
    return getStoredValue(selections, getSelectionKey(guildId, userId)) || null
  }

  function setSelectedPlayer(guildId, userId, playerId) {
    setStoredValue(selections, getSelectionKey(guildId, userId), playerId)
  }

  function clearRandomRoleDraft(guildId, userId) {
    randomRoleDrafts.delete(getSelectionKey(guildId, userId))
  }

  function clearNominationDraft(guildId, userId) {
    nominationDrafts.delete(getSelectionKey(guildId, userId))
  }

  function getNominationDraft(guildId, userId) {
    return getStoredValue(nominationDrafts, getSelectionKey(guildId, userId)) || {}
  }

  function setNominationDraft(guildId, userId, draft) {
    const normalized = {
      nominatorId: draft?.nominatorId || null,
      nomineeId: draft?.nomineeId || null
    }
    setStoredValue(nominationDrafts, getSelectionKey(guildId, userId), normalized)
    return normalized
  }

  function setNominationDraftChoice(guildId, userId, key, playerId) {
    const draft = { ...getNominationDraft(guildId, userId), [key]: playerId || null }
    return setNominationDraft(guildId, userId, draft)
  }

  function getRandomRoleDraft(guildId, userId) {
    return getStoredValue(randomRoleDrafts, getSelectionKey(guildId, userId)) || {}
  }

  function setRandomRoleDraftTeam(guildId, userId, team, roleIds) {
    const key = getSelectionKey(guildId, userId)
    const draft = { ...getRandomRoleDraft(guildId, userId) }
    draft[team] = [...new Set(roleIds || [])]
    if (team === 'outsider' && !draft[team].includes('drunk')) delete draft.drunkShownRoleId
    setStoredValue(randomRoleDrafts, key, draft)
    return draft
  }

  function setRandomRoleDraftDrunkShown(guildId, userId, roleId) {
    const key = getSelectionKey(guildId, userId)
    const draft = { ...getRandomRoleDraft(guildId, userId) }
    draft.drunkShownRoleId = roleId || null
    setStoredValue(randomRoleDrafts, key, draft)
    return draft
  }

  function prune(now = Date.now()) {
    return pruneMap(selections, now) +
      pruneMap(nominationDrafts, now) +
      pruneMap(randomRoleDrafts, now)
  }

  function getRuntimeState({ now = Date.now() } = {}) {
    const removed = prune(now)
    return {
      nominationDrafts: nominationDrafts.size,
      randomRoleDrafts: randomRoleDrafts.size,
      refreshTimers: refreshTimers.size,
      removed,
      selections: selections.size
    }
  }

  function getSelectionKey(guildId, userId) {
    return `${guildId}:${userId}`
  }

  return {
    clear,
    clearNominationDraft,
    clearRandomRoleDraft,
    getRuntimeState,
    getNominationDraft,
    getRandomRoleDraft,
    getSelectedPlayer,
    registerRefresh,
    prune,
    setNominationDraft,
    setNominationDraftChoice,
    setRandomRoleDraftDrunkShown,
    setRandomRoleDraftTeam,
    setSelectedPlayer
  }
}

function getStoredValue(map, key) {
  const entry = map.get(key)
  if (!entry || typeof entry !== 'object' || !Object.prototype.hasOwnProperty.call(entry, 'value')) {
    return entry
  }
  return entry.value
}

function setStoredValue(map, key, value) {
  map.set(key, {
    updatedAt: Date.now(),
    value
  })
}

function pruneMap(map, now) {
  let removed = 0
  const cutoff = now - DASHBOARD_STATE_TTL_MS
  for (const [key, entry] of map.entries()) {
    if (entry?.updatedAt && entry.updatedAt > cutoff) continue
    map.delete(key)
    removed += 1
  }
  return removed
}

module.exports = {
  createStorytellerDashboardState
}
