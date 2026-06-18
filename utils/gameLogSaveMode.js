const GAME_LOG_SAVE_MODES = Object.freeze({
  auto: 'auto',
  manual: 'manual'
})

function normalizeGameLogSaveMode(mode, fallback = GAME_LOG_SAVE_MODES.manual) {
  return Object.values(GAME_LOG_SAVE_MODES).includes(mode) ? mode : fallback
}

module.exports = {
  GAME_LOG_SAVE_MODES,
  normalizeGameLogSaveMode
}
