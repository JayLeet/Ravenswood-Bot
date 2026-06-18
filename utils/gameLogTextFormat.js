function withGameLogDisplayNames(summary, savedById = null, options = {}) {
  const displayNames = { ...(summary?.displayNames || {}) }
  const savedByDisplayName = normalizeDisplayName(options.savedByDisplayName)
  if (savedById && savedByDisplayName) displayNames[savedById] = savedByDisplayName
  return { ...(summary || {}), displayNames }
}

function formatPlainUser(summary, userId) {
  const name = normalizeDisplayName(summary?.displayNames?.[userId])
  if (name) return name
  return userId ? 'Unknown user' : 'Unknown'
}

function formatPlainText(summary, value) {
  return String(value || '')
    .replace(/<@!?(\d+)>/g, (_match, userId) => formatPlainUser(summary, userId))
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDuration(durationMs) {
  const value = Number(durationMs)
  if (!Number.isFinite(value) || value <= 0) return 'Unknown'

  const totalSeconds = Math.max(1, Math.round(value / 1000))
  if (totalSeconds < 60) return `${totalSeconds} sec`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds ? `${minutes} min ${seconds} sec` : `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function formatReadableTimestamp(value) {
  const time = Number(value)
  if (!Number.isFinite(time) || time <= 0) return 'Unknown'

  const date = new Date(time)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  const year = date.getUTCFullYear()
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${hour}:${minute} UTC`
}

function normalizeDisplayName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim()
  return name || null
}

function isFakeUserId(userId) {
  return /^(test-player-|fake[_-])/.test(String(userId || ''))
}

module.exports = {
  formatDuration,
  formatPlainText,
  formatPlainUser,
  formatReadableTimestamp,
  isFakeUserId,
  normalizeDisplayName,
  withGameLogDisplayNames
}
