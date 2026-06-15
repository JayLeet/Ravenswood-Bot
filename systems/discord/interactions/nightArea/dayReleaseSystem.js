const {
  releaseAssignedNightAreasForDay
} = require('./dayRelease')
const {
  createBotLogger
} = require('../../../../utils/logger')

function createNightAreaDayReleaseSystem({
  client,
  gameLifecycle
}) {
  const log = createBotLogger({ subsystem: 'NightAreaDayRelease' })
  let registered = false

  function registerNightAreaDayRelease() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('PHASE_CHANGED', async ({ game, from, to }) => {
      if (!game?.guildId || from !== 'night' || to !== 'day') return
      await releaseAssignedNightAreasForDay({
        client,
        game,
        gameLifecycle,
        guildId: game.guildId
      }).catch(err => {
        log.recoverable('release-assigned-night-areas-for-day', err, { guildId: game.guildId })
      })
    })

    return true
  }

  return {
    registerNightAreaDayRelease
  }
}

module.exports = {
  createNightAreaDayReleaseSystem
}
