const GameLifecycleManager = require('../game/GameLifecycleManager')
const {
  registerRuntimeMaintenanceTask
} = require('../../utils/runtimeMaintenance')

function createGameLifecycleRuntime({
  deleteExpiredPendingGameSummaries,
  deletePendingGameSummary,
  gameManager,
  loadCreateGameCooldowns,
  pruneCreateGameCooldowns,
  saveCreateGameCooldown,
  saveGames,
  savePendingGameSummary,
  updateAchievementStats
}) {
  const gameLifecycle = new GameLifecycleManager({
    deletePendingGameSummary,
    gameManager,
    loadCreateGameCooldowns,
    saveCreateGameCooldown,
    saveGames,
    savePendingGameSummary,
    updateAchievementStats
  })

  registerRuntimeMaintenanceTask('pendingGameSummaries', ({ now }) => ({
    removed: deleteExpiredPendingGameSummaries(now)
  }))
  registerRuntimeMaintenanceTask('createGameCooldowns', ({ now }) => {
    const removedMemory = gameLifecycle.pruneCreateGameCooldowns?.(now) || 0
    const removedStored = pruneCreateGameCooldowns ? pruneCreateGameCooldowns(now) : 0
    return {
      removed: removedMemory + removedStored,
      removedMemory,
      removedStored
    }
  })

  return gameLifecycle
}

module.exports = {
  createGameLifecycleRuntime
}
