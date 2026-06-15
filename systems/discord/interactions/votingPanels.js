const {
  clearVotingPanelSignaturesForGuild,
  postOrUpdateVotingPanelMessage
} = require('./votingPanelPosting')
const {
  createVotingPanelCountdown
} = require('./votingPanelCountdown')
const {
  clearTimerMap,
  normalizeCountDelay
} = require('./votingPanelTimers')
const {
  recoverVotingPanels: recoverVotingPanelsFromView
} = require('./votingPanelRecovery')
const {
  createRecoveredVoteCountResumer
} = require('./votingPanelRecoveryResume')
const {
  registerVotingPanelEvents
} = require('./votingPanelEvents')
const {
  createVotingInteractionHandler
} = require('./votingPanelVoteHandler')
const {
  createVoteButtonCooldown
} = require('./voteButtonCooldown')
const {
  createBotLogger
} = require('../../../utils/logger')

function createVotingPanelSystem({
  client,
  serverConfigs,
  gameLifecycle,
  isSetupComplete,
  getDashboardPlayerLabels,
  postOrUpdateStorytellerDashboard,
  countdownWait,
  clearTimeoutFn = clearTimeout,
  refreshDelayMs = 500,
  setTimeoutFn = setTimeout,
  voteButtonDisableMs = 1000
}) {
  const log = createBotLogger({ subsystem: 'VotingPanels' })
  const refreshTimers = new Map()
  const countTimers = new Map()
  const voteButtonTimers = new Map()
  const voteButtonCooldown = createVoteButtonCooldown()
  const messageSignatures = new Map()
  let refreshRegistered = false
  const resumeRecoveredVoteCounts = createRecoveredVoteCountResumer({ scheduleVoteCountTick })
  const postingDeps = {
    gameLifecycle,
    getDashboardPlayerLabels,
    isSetupComplete,
    log,
    messageSignatures,
    serverConfigs
  }
  const countdown = createVotingPanelCountdown({
    getVotingPanelState,
    postVotingPanel: (guildId, nomination, view, options) =>
      postOrUpdateVotingPanel(client, guildId, nomination, view, null, options),
    scheduleVoteCountTick,
    wait: countdownWait
  })

  function registerVotingPanelRefresh() {
    if (refreshRegistered) return false
    refreshRegistered = true

    registerVotingPanelEvents({
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
    })

    return true
  }

  function getVotingPanelState(guildId, nominationId) {
    const view = gameLifecycle.getGameView(guildId)
    const nomination = (view?.engine?.nominations || []).find(item => item.id === nominationId)
    return { nomination, view }
  }

  function scheduleVotingPanelRefresh(guildId, nominationId, options = {}) {
    const key = `${guildId}:${nominationId}`
    const existing = refreshTimers.get(key)
    if (existing) clearTimeoutFn(existing)

    const timer = setTimeoutFn(async () => {
      refreshTimers.delete(key)
      if (isVoteButtonDisableActive(guildId, nominationId) && !options.forceDuringButtonDisable) return

      const view = gameLifecycle.getGameView(guildId)
      const nomination = (view?.engine.nominations || []).find(item => item.id === nominationId)
      if (!nomination) return

      await postOrUpdateVotingPanel(client, guildId, nomination, view, null, options).catch(err => {
        log.recoverable('refresh-voting-panel', err, {
          guildId,
          nominationId
        })
      })
    }, refreshDelayMs)

    refreshTimers.set(key, timer)
  }

  function scheduleVoteCountTick(guildId, nominationId, member, speedMs) {
    const key = `${guildId}:${nominationId}`
    clearVoteCountTimer(guildId, nominationId)

    const timer = setTimeoutFn(async () => {
      countTimers.delete(key)
      await runVoteCountTick(guildId, nominationId, member)
    }, normalizeCountDelay(speedMs))

    countTimers.set(key, timer)
  }

  async function runVoteCountTick(guildId, nominationId, member) {
    if (!member) return
    const view = gameLifecycle.getGameView(guildId)
    const nomination = (view?.engine.nominations || []).find(item => item.id === nominationId)
    if (nomination?.status !== 'voting') return

    const result = await Promise.resolve()
      .then(() => gameLifecycle.countNextVote(guildId, member))
      .catch(err => {
        log.recoverable('count-next-vote', err, {
          guildId,
          nominationId,
          userId: member.id
        })
        return null
      })

    if (!result?.ok) return
    const nextView = gameLifecycle.getGameView(guildId)
    const nextNomination = (nextView?.engine.nominations || []).find(item => item.id === nominationId)
    if (nextNomination?.status === 'voting') {
      scheduleVoteCountTick(guildId, nominationId, member, nextNomination.voteClockhandSpeedMs)
    }
  }

  async function temporarilyDisableVotingButtons(discordClient, guildId, nomination, view, message) {
    await postOrUpdateVotingPanel(discordClient, guildId, nomination, view, message, {
      disableVoteButtons: true
    })
    scheduleVoteButtonEnable(guildId, nomination.id)
  }

  function scheduleVoteButtonEnable(guildId, nominationId) {
    const key = `${guildId}:${nominationId}`
    clearVoteButtonTimer(guildId, nominationId)

    const timer = setTimeoutFn(() => {
      voteButtonTimers.delete(key)
      scheduleVotingPanelRefresh(guildId, nominationId)
    }, voteButtonDisableMs)
    voteButtonTimers.set(key, timer)
  }

  function isVoteButtonDisableActive(guildId, nominationId) {
    return voteButtonTimers.has(`${guildId}:${nominationId}`)
  }

  function clearVotingPanelTimers(guildId) {
    clearTimerMap(refreshTimers, guildId, clearTimeoutFn)
    clearTimerMap(countTimers, guildId, clearTimeoutFn)
    clearTimerMap(voteButtonTimers, guildId, clearTimeoutFn)
    countdown.clearGuild(guildId)
    clearVotingPanelSignaturesForGuild(messageSignatures, guildId)
  }

  function clearVoteCountTimer(guildId, nominationId) {
    const key = `${guildId}:${nominationId}`
    const timer = countTimers.get(key)
    if (!timer) return
    clearTimeoutFn(timer)
    countTimers.delete(key)
  }

  function clearVoteButtonTimer(guildId, nominationId) {
    clearNamedTimer(voteButtonTimers, guildId, nominationId)
  }

  function clearNamedTimer(map, guildId, nominationId) {
    const key = `${guildId}:${nominationId}`
    const timer = map.get(key)
    if (!timer) return
    clearTimeoutFn(timer)
    map.delete(key)
  }

  function postOrUpdateVotingPanel(discordClient, guildId, nomination, view, knownMessage = null, options = {}) {
    return postOrUpdateVotingPanelMessage({
      deps: postingDeps,
      discordClient,
      guildId,
      knownMessage,
      nomination,
      options,
      view
    })
  }

  const handleVotingInteraction = createVotingInteractionHandler({
    gameLifecycle,
    postOrUpdateStorytellerDashboard,
    postOrUpdateVotingPanel,
    setTimeoutFn,
    temporarilyDisableVotingButtons,
    voteButtonCooldown
  })

  function getRuntimeState({ now = Date.now() } = {}) {
    const removedStaleCountdownRuns = countdown.pruneStale?.(now) || 0

    return {
      countdownRuns: countdown.size?.() || 0,
      messageSignatures: messageSignatures.size,
      refreshTimers: refreshTimers.size,
      voteButtonCooldowns: voteButtonCooldown.size(),
      voteButtonTimers: voteButtonTimers.size,
      voteCountTimers: countTimers.size,
      removedStaleCountdownRuns,
      removedVoteButtonCooldowns: voteButtonCooldown.prune(now)
    }
  }

  return {
    clearGuild: clearVotingPanelTimers,
    getRuntimeState,
    handleVotingInteraction,
    postOrUpdateVotingPanel,
    registerVotingPanelRefresh,
    recoverVotingPanels: async (discordClient, guildId, view) => {
      const recovered = await recoverVotingPanelsFromView({
        discordClient,
        guildId,
        postOrUpdateVotingPanel,
        view
      })
      const voteCountsResumed = resumeRecoveredVoteCounts(guildId, view)
      return {
        voteCountsResumed,
        votingPanels: recovered
      }
    },
    resumeRecoveredVoteCounts
  }
}

module.exports = {
  createVotingPanelSystem,
  normalizeCountDelay
}
