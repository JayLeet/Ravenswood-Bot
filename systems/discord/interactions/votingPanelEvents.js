const { deleteVotingPanel } = require('./votingPanelDelete')

function registerVotingPanelEvents({
  client,
  countdown,
  gameLifecycle,
  log,
  messageSignatures,
  postOrUpdateStorytellerDashboard,
  scheduleVotingPanelRefresh,
  serverConfigs,
  clearVoteButtonTimer,
  clearVoteCountTimer,
  clearVotingPanelTimers
}) {
  for (const event of ['NOMINATION_CREATED', 'PERTINENCE_CHANGED', 'VOTE_CAST']) {
    gameLifecycle.events.on(event, ({ game, nomination }) => {
      if (game?.guildId && nomination) scheduleVotingPanelRefresh(game.guildId, nomination.id)
    })
  }

  gameLifecycle.events.on('VOTE_OPENED', ({ game, member, nomination }) => {
    if (!game?.guildId || !nomination) return
    countdown.start(game.guildId, nomination.id, member, nomination.voteClockhandSpeedMs)
      .catch(err => log.recoverable('start-voting-countdown', err, {
        guildId: game.guildId,
        nominationId: nomination.id
      }))
  })

  gameLifecycle.events.on('VOTE_COUNTED', ({ game, nomination }) => {
    if (!game?.guildId || !nomination) return
    scheduleVotingPanelRefresh(game.guildId, nomination.id)
    postOrUpdateStorytellerDashboard(client, game.guildId).catch(err => {
      log.recoverable('refresh-dashboard-after-vote-count', err, {
        guildId: game.guildId,
        nominationId: nomination.id
      })
    })
  })

  gameLifecycle.events.on('NOMINATION_CANCELLED', ({ game, nomination }) => {
    if (!game?.guildId || !nomination) return
    countdown.cancel(game.guildId, nomination.id)
    clearVoteCountTimer(game.guildId, nomination.id)
    clearVoteButtonTimer(game.guildId, nomination.id)
    deleteVotingPanel({ client, guildId: game.guildId, log, messageSignatures, nomination, serverConfigs }).catch(err => {
      log.recoverable('delete-voting-panel', err, {
        guildId: game.guildId,
        nominationId: nomination.id
      })
    })
    postOrUpdateStorytellerDashboard(client, game.guildId).catch(err => {
      log.recoverable('refresh-dashboard-after-nomination-cancel', err, {
        guildId: game.guildId,
        nominationId: nomination.id
      })
    })
  })

  gameLifecycle.events.on('VOTE_PAUSED', ({ game, nomination }) => {
    if (!game?.guildId || !nomination) return
    countdown.cancel(game.guildId, nomination.id)
    clearVoteCountTimer(game.guildId, nomination.id)
    clearVoteButtonTimer(game.guildId, nomination.id)
    scheduleVotingPanelRefresh(game.guildId, nomination.id, {
      forceDuringButtonDisable: true
    })
    postOrUpdateStorytellerDashboard(client, game.guildId).catch(err => {
      log.recoverable('refresh-dashboard-after-vote-pause', err, {
        guildId: game.guildId,
        nominationId: nomination.id
      })
    })
  })

  gameLifecycle.events.on('VOTE_RESOLVED', ({ game, nomination }) => {
    if (!game?.guildId || !nomination) return
    countdown.cancel(game.guildId, nomination.id)
    clearVoteCountTimer(game.guildId, nomination.id)
    clearVoteButtonTimer(game.guildId, nomination.id)
    scheduleVotingPanelRefresh(game.guildId, nomination.id)
  })

  gameLifecycle.events.on('GAME_ENDED', ({ game }) => {
    if (game?.guildId) clearVotingPanelTimers(game.guildId)
  })
}

module.exports = {
  registerVotingPanelEvents
}
