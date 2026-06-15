const DEFAULT_COUNTDOWN_DELAY_MS = 1000
const VOTE_COUNTDOWN_STEPS = Object.freeze([
  '# **3**',
  '# **2**',
  '# **1**',
  '# **GO!**'
])
const DEFAULT_COUNTDOWN_STALE_MS = 60 * 1000

function createVotingPanelCountdown({
  getVotingPanelState,
  maxRunMs = DEFAULT_COUNTDOWN_STALE_MS,
  postVotingPanel,
  scheduleVoteCountTick,
  wait = delay
}) {
  const activeRuns = new Map()

  function start(guildId, nominationId, member, speedMs) {
    const key = createCountdownKey(guildId, nominationId)
    const token = Symbol(key)
    activeRuns.set(key, { startedAt: Date.now(), token })
    return runCountdown({ guildId, key, member, nominationId, speedMs, token })
  }

  function cancel(guildId, nominationId) {
    activeRuns.delete(createCountdownKey(guildId, nominationId))
  }

  function clearGuild(guildId) {
    for (const key of activeRuns.keys()) {
      if (key.startsWith(`${guildId}:`)) activeRuns.delete(key)
    }
  }

  function pruneStale(now = Date.now()) {
    let removed = 0
    for (const [key, run] of activeRuns.entries()) {
      if (now - run.startedAt <= maxRunMs) continue
      activeRuns.delete(key)
      removed += 1
    }
    return removed
  }

  async function runCountdown({ guildId, key, member, nominationId, speedMs, token }) {
    try {
      let replaceMessage = true

      for (const countdownText of VOTE_COUNTDOWN_STEPS) {
        const state = getVotingPanelState(guildId, nominationId)
        if (!isCurrentVotingRun(activeRuns, key, token, state.nomination)) return

        await postVotingPanel(guildId, state.nomination, state.view, {
          countdownText,
          replaceMessage
        })
        replaceMessage = false

        if (countdownText !== VOTE_COUNTDOWN_STEPS.at(-1)) {
          await wait(DEFAULT_COUNTDOWN_DELAY_MS)
        }
      }

      const state = getVotingPanelState(guildId, nominationId)
      if (!isCurrentVotingRun(activeRuns, key, token, state.nomination)) return
      scheduleVoteCountTick(guildId, nominationId, member, speedMs)
    } finally {
      clearCurrentVotingRun(activeRuns, key, token)
    }
  }

  return {
    cancel,
    clearGuild,
    pruneStale,
    size: () => activeRuns.size,
    start
  }
}

function isCurrentVotingRun(activeRuns, key, token, nomination) {
  return activeRuns.get(key)?.token === token && nomination?.status === 'voting'
}

function clearCurrentVotingRun(activeRuns, key, token) {
  if (activeRuns.get(key)?.token === token) activeRuns.delete(key)
}

function createCountdownKey(guildId, nominationId) {
  return `${guildId}:${nominationId}`
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  VOTE_COUNTDOWN_STEPS,
  createVotingPanelCountdown
}
