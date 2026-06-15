const {
  createNightWakeEntries
} = require('../../../../utils/storytellerDashboard/nightGuidance')
const {
  getNightOrderState,
  setNightOrderState
} = require('./nightOrderState')

function updateNightOrderState(guildId, view, parsed) {
  if (!parsed) return getNightOrderState(guildId, view)
  const current = getNightOrderState(guildId, view)
  const maxIndex = Math.max(0, createNightWakeEntries(view).length - 1)
  const index = getNextNightOrderIndex(parsed, current.index)
  if (index === null) return current
  return setNightOrderState(guildId, view, {
    started: true,
    index: clampNightOrderIndex(index, maxIndex)
  })
}

function getNextNightOrderIndex(parsed, currentIndex) {
  if (parsed.action === 'start') return parsed.index ?? 0
  if (parsed.action === 'back') return currentIndex - 1
  if (parsed.action === 'next') return currentIndex + 1
  if (isWakeMenuAction(parsed) || parsed.action === 'move') return parsed.index ?? currentIndex
  return null
}

function isWakeMenuAction(parsed) {
  return [
    'wake',
    'wake-back',
    'wake-clear',
    'wake-not-in-play',
    'wake-page',
    'wake-player',
    'wake-prompt',
    'wake-role',
    'wake-send',
    'wake-submit'
  ].includes(parsed?.action)
}

function clampNightOrderIndex(index, maxIndex) {
  const value = Number(index)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.floor(value), maxIndex))
}

module.exports = {
  updateNightOrderState
}
