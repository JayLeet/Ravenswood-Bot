const {
  GAME_LOG_SAVE_MODES,
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')
const {
  createGameLogDecisionRows
} = require('./gameLogDecisions')
const {
  saveGameLogSummary
} = require('./gameLogArchive')

async function createEndGameLogComponents({
  client,
  deletePendingGameSummary = null,
  guildId,
  result,
  serverConfigs
}) {
  const summary = result?.pendingSummary
  if (!summary?.id) return []

  const config = serverConfigs?.get?.(guildId) || {}
  const saveMode = normalizeGameLogSaveMode(config.gameLogSaveMode, GAME_LOG_SAVE_MODES.manual)
  if (saveMode !== GAME_LOG_SAVE_MODES.auto) return createGameLogDecisionRows(summary.id)

  const saved = await saveGameLogSummary({
    client,
    guildId,
    savedById: null,
    serverConfigs,
    summary
  })
  if (!saved.ok) return createGameLogDecisionRows(summary.id)

  deletePendingGameSummary?.(guildId)
  return []
}

module.exports = {
  createEndGameLogComponents
}
