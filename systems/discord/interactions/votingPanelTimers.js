const DEFAULT_COUNT_DELAY_MS = 1000
const MIN_COUNT_DELAY_MS = 500
const MAX_COUNT_DELAY_MS = 3000

function clearTimerMap(map, guildId, clearTimeoutFn = clearTimeout) {
  for (const [key, timer] of map.entries()) {
    if (!key.startsWith(`${guildId}:`)) continue
    clearTimeoutFn(timer)
    map.delete(key)
  }
}

function normalizeCountDelay(speedMs) {
  const value = Number(speedMs)
  if (!Number.isFinite(value)) return DEFAULT_COUNT_DELAY_MS
  return Math.max(MIN_COUNT_DELAY_MS, Math.min(MAX_COUNT_DELAY_MS, Math.round(value)))
}

module.exports = {
  clearTimerMap,
  normalizeCountDelay
}
