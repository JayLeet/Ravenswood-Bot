const nightOrderStates = new Map()

function getNightOrderState(guildId, view = null) {
  const key = getGuildKey(guildId)
  const state = nightOrderStates.get(key) || createDefaultNightOrderState(view)
  if (!view || state.nightKey === getNightOrderKey(view)) return state
  return createDefaultNightOrderState(view)
}

function setNightOrderState(guildId, view, updates = {}) {
  const key = getGuildKey(guildId)
  const current = getNightOrderState(guildId, view)
  const next = {
    index: normalizeNightOrderIndex(updates.index ?? current.index),
    nightKey: getNightOrderKey(view),
    started: updates.started ?? current.started
  }
  nightOrderStates.set(key, next)
  return next
}

function clearNightOrderState(guildId) {
  nightOrderStates.delete(getGuildKey(guildId))
}

function resetNightOrderStates() {
  nightOrderStates.clear()
}

function getNightOrderStateRuntimeState({ activeGuildIds = null } = {}) {
  const removed = activeGuildIds ? pruneNightOrderStates(activeGuildIds) : 0
  return {
    removed,
    size: nightOrderStates.size
  }
}

function pruneNightOrderStates(activeGuildIds) {
  const active = new Set(activeGuildIds.map(getGuildKey))
  let removed = 0

  for (const guildId of nightOrderStates.keys()) {
    if (active.has(guildId)) continue
    nightOrderStates.delete(guildId)
    removed += 1
  }

  return removed
}

function createDefaultNightOrderState(view = null) {
  return {
    index: 0,
    nightKey: getNightOrderKey(view),
    started: false
  }
}

function getNightOrderKey(view = null) {
  return [view?.day || 0, view?.phase || 'none'].join(':')
}

function normalizeNightOrderIndex(index) {
  const value = Number(index)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function getGuildKey(guildId) {
  return String(guildId || '')
}

module.exports = {
  clearNightOrderState,
  createDefaultNightOrderState,
  getNightOrderKey,
  getNightOrderState,
  getNightOrderStateRuntimeState,
  normalizeNightOrderIndex,
  pruneNightOrderStates,
  resetNightOrderStates,
  setNightOrderState
}
