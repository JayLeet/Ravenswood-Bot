const {
  acknowledgeInteraction,
  deferPrivateReply
} = require('./feedback')
const {
  deleteDiagnostic,
  editDiagnostic,
  sendDiagnostic
} = require('./adminDiagnosticHandles')
const {
  createDiagnosticContext,
  createDiagnosticPayload,
  hasAdministrator
} = require('./adminDiagnosticPayloads')
const {
  DEFAULT_SLOW_INTERACTION_NOTICE_MS,
  DEFAULT_INTERACTION_ACK_MS,
  FINISHED_DIAGNOSTIC_DELETE_DELAY_MS,
  MIN_RUNNING_DIAGNOSTIC_DISPLAY_MS,
  RUNNING_DIAGNOSTIC_PROGRESS_INTERVAL_MS,
  createRunningDescription,
  getInteractionAckDelayMs,
  getRunningNoticeLevel,
  getRunningReason,
  getRunningTitle
} = require('./adminDiagnosticTiming')

const ADMIN_DIAGNOSTIC_STATE = Symbol('botcAdminDiagnosticState')

function createAdminInteractionDiagnostics({
  serverConfigs,
  slowInteractionNoticeMs = DEFAULT_SLOW_INTERACTION_NOTICE_MS
}) {
  function watch(interaction) {
    const context = createDiagnosticContext(interaction, serverConfigs)
    if (!context) return createNoopWatch()

    let finished = false
    let failed = false
    let finishedNoticeSent = false
    let diagnosticMessage = null
    let diagnosticActive = false
    let finishDelayTimer = null
    let finishRequested = false
    let progressStep = 0
    let progressTimer = null
    let progressUpdatePromise = null
    let runningNoticeLevel = 'normal'
    let slowNoticeShownAt = 0
    let slowNoticePromise = null
    let slowNoticeSent = false
    const startedAt = Date.now()
    interaction[ADMIN_DIAGNOSTIC_STATE] = {
      hasVisibleDiagnostic: () => diagnosticActive
    }
    interaction.botcHasVisibleAdminDiagnostic = () => hasVisibleAdminInteractionDiagnostic(interaction)
    const ackTimer = setTimeout(() => {
      acknowledgeDiagnosticInteraction(interaction).catch(() => null)
    }, getInteractionAckDelayMs(slowInteractionNoticeMs))
    const timer = setTimeout(() => {
      slowNoticePromise = sendSlowNotice().catch(() => false)
    }, slowInteractionNoticeMs)

    async function sendSlowNotice() {
      if (finished || failed || slowNoticeSent) return false
      slowNoticeSent = true
      diagnosticActive = true
      clearAckTimer()

      if (!hasInteractionResponse(interaction)) await acknowledgeDiagnosticInteraction(interaction)

      diagnosticMessage = await sendDiagnostic(interaction, createDiagnosticPayload({
        color: 0xf1c40f,
        context,
        description: createRunningDescription(context, runningNoticeLevel),
        elapsedMs: Date.now() - startedAt,
        progressStep,
        reason: getRunningReason(context),
        title: 'Action still running'
      }))
      if (!diagnosticMessage) {
        diagnosticActive = false
        if (finishRequested) finished = true
        return false
      }

      slowNoticeShownAt = Date.now()
      startProgressUpdates()
      if (finishRequested) finishAfterMinimumRunningDisplay()
      return Boolean(diagnosticMessage)
    }

    async function reportFailure(err) {
      failed = true
      clearTimeout(timer)
      clearAckTimer()
      clearFinishDelay()
      if (slowNoticePromise) await slowNoticePromise.catch(() => null)
      if (diagnosticMessage) await waitForMinimumRunningDisplay()
      finished = true
      clearProgressUpdates()
      await waitForProgressUpdate()
      const payload = createDiagnosticPayload({
        color: 0xe74c3c,
        context,
        description: 'This action failed while the bot was handling it. Check the bot terminal logs around this action for the full error.',
        elapsedMs: Date.now() - startedAt,
        error: err,
        title: 'Action failed'
      })
      if (diagnosticMessage) return Boolean(await editDiagnostic(diagnosticMessage, payload).catch(() => null))
      diagnosticActive = true
      diagnosticMessage = await sendDiagnostic(interaction, payload)
      if (!diagnosticMessage) diagnosticActive = false
      return Boolean(diagnosticMessage)
    }

    function finish() {
      clearTimeout(timer)
      clearAckTimer()
      if (failed || finished) return
      if (!slowNoticeSent) {
        finished = true
        diagnosticActive = false
        clearProgressUpdates()
        return
      }

      finishRequested = true
      if (diagnosticMessage) finishAfterMinimumRunningDisplay()
    }

    function startProgressUpdates() {
      if (progressTimer) return
      progressTimer = setInterval(() => {
        if (progressUpdatePromise) return
        progressUpdatePromise = updateProgressNotice()
          .catch(() => null)
          .finally(() => {
            progressUpdatePromise = null
          })
      }, RUNNING_DIAGNOSTIC_PROGRESS_INTERVAL_MS)
    }

    function clearProgressUpdates() {
      if (!progressTimer) return
      clearInterval(progressTimer)
      progressTimer = null
    }

    async function updateProgressNotice() {
      if (finished || failed || !diagnosticMessage) return false
      progressStep += 1
      const elapsedMs = Date.now() - startedAt
      runningNoticeLevel = getRunningNoticeLevel(elapsedMs)
      const updated = await editCurrentDiagnostic(createDiagnosticPayload({
        color: 0xf1c40f,
        context,
        description: createRunningDescription(context, runningNoticeLevel),
        elapsedMs,
        progressStep,
        reason: getRunningReason(context),
        title: getRunningTitle(runningNoticeLevel)
      })).catch(() => null)
      return Boolean(updated)
    }

    async function sendFinishedNotice() {
      if (finishedNoticeSent || !diagnosticMessage) return false
      finishedNoticeSent = true
      clearProgressUpdates()
      await waitForProgressUpdate()
      const payload = createDiagnosticPayload({
        color: 0x2ecc71,
        context,
        description: 'This action has finished.',
        elapsedMs: Date.now() - startedAt,
        title: 'Action finished'
      })
      const updated = await editCurrentDiagnostic(payload).catch(() => null)
      if (!updated) {
        diagnosticActive = false
        return false
      }
      setTimeout(() => {
        deleteDiagnostic(updated, 'Finished interaction diagnostic expired')
          .catch(() => null)
          .finally(() => {
            if (diagnosticMessage === updated) diagnosticMessage = null
            diagnosticActive = false
          })
      }, FINISHED_DIAGNOSTIC_DELETE_DELAY_MS)
      return true
    }

    async function editCurrentDiagnostic(payload) {
      if (!diagnosticMessage) return null
      const updated = await editDiagnostic(diagnosticMessage, payload)
      if (updated) diagnosticMessage = updated
      return updated
    }

    function waitForProgressUpdate() {
      return progressUpdatePromise?.catch(() => null) || Promise.resolve()
    }

    function finishAfterMinimumRunningDisplay() {
      if (failed || finishedNoticeSent) return
      const remainingMs = getMinimumRunningDisplayRemainingMs()
      if (remainingMs > 0) {
        if (!finishDelayTimer) {
          finishDelayTimer = setTimeout(() => {
            finishDelayTimer = null
            finishAfterMinimumRunningDisplay()
          }, remainingMs)
        }
        return
      }

      finished = true
      sendFinishedNotice().catch(() => null)
    }

    function getMinimumRunningDisplayRemainingMs() {
      if (!slowNoticeShownAt) return 0
      return Math.max(0, MIN_RUNNING_DIAGNOSTIC_DISPLAY_MS - (Date.now() - slowNoticeShownAt))
    }

    function waitForMinimumRunningDisplay() {
      const remainingMs = getMinimumRunningDisplayRemainingMs()
      if (remainingMs <= 0) return Promise.resolve()
      return new Promise(resolve => setTimeout(resolve, remainingMs))
    }

    function clearFinishDelay() {
      if (!finishDelayTimer) return
      clearTimeout(finishDelayTimer)
      finishDelayTimer = null
    }

    function clearAckTimer() {
      if (!ackTimer) return
      clearTimeout(ackTimer)
    }

    return {
      finish,
      reportFailure
    }
  }

  return { watch }
}

function createNoopWatch() {
  return { finish: () => null, reportFailure: async () => false }
}

function hasInteractionResponse(interaction) {
  return interaction.deferred === true || interaction.replied === true
}

function acknowledgeDiagnosticInteraction(interaction) {
  return acknowledgeInteraction(interaction) || deferPrivateReply(interaction)
}

function hasVisibleAdminInteractionDiagnostic(interaction) {
  return Boolean(interaction?.[ADMIN_DIAGNOSTIC_STATE]?.hasVisibleDiagnostic?.())
}

module.exports = {
  DEFAULT_SLOW_INTERACTION_NOTICE_MS,
  DEFAULT_INTERACTION_ACK_MS,
  FINISHED_DIAGNOSTIC_DELETE_DELAY_MS,
  MIN_RUNNING_DIAGNOSTIC_DISPLAY_MS,
  createAdminInteractionDiagnostics,
  hasAdministrator,
  hasVisibleAdminInteractionDiagnostic
}
