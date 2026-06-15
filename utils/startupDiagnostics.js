const {
  runRuntimeMaintenance
} = require('./runtimeMaintenance')
const {
  beginStartupOutput,
  routeStartupLog,
  writeLog
} = require('./startupOutput')

function installProcessDiagnostics(processRef = process, logger = console) {
  processRef.on('unhandledRejection', err => {
    logError(logger, '[BOTC][Process] UNHANDLED REJECTION', err)
  })

  processRef.on('uncaughtException', err => {
    logError(logger, '[BOTC][Process] UNCAUGHT EXCEPTION', err)
  })

  processRef.on('warning', warning => {
    logError(logger, '[BOTC][Process] WARNING', warning, 'warn')
  })
}

function installClientDiagnostics(client, logger = console) {
  client.on('error', err => {
    logError(logger, '[BOTC][DiscordClient] error', err)
  })

  client.on('warn', message => {
    logMessage(logger, 'warn', `[BOTC][DiscordClient] warning: ${message}`)
  })

  client.on('shardError', (err, shardId) => {
    logError(logger, `[BOTC][DiscordClient] shard ${shardId} error`, err)
  })

  client.on('shardDisconnect', (event, shardId) => {
    logMessage(logger, 'warn', `[BOTC][DiscordClient] shard ${shardId} disconnected: ${formatDiagnostic(event)}`)
  })

  client.on('shardReconnecting', shardId => {
    logMessage(logger, 'warn', `[BOTC][DiscordClient] shard ${shardId} reconnecting`)
  })

  client.on('shardResume', (shardId, replayedEvents) => {
    logMessage(logger, 'info', `[BOTC][DiscordClient] shard ${shardId} resumed; replayedEvents=${replayedEvents}`)
  })
}

function logStartupStep(message, logger = console) {
  logMessage(logger, 'info', `[BOTC][Startup] ${message}`)
}

function loginWithDiagnostics(client, token, logger = console) {
  if (!token) {
    const err = new Error('DISCORD_TOKEN is not set.')
    logError(logger, '[BOTC][Startup] Discord login not attempted', err)
    return Promise.reject(err)
  }

  logStartupStep('Logging in to Discord...', logger)
  return client.login(token)
    .then(result => {
      logStartupMilestone('Login request accepted; waiting for clientReady.', logger)
      return result
    })
    .catch(err => {
      logError(logger, '[BOTC][Startup] Discord login failed', err)
      throw err
    })
}

function logStartupMilestone(message, logger = console) {
  const line = `[BOTC][Startup] ${message}`
  if (typeof logger?.milestone === 'function') {
    logger.milestone(line)
  }
}

function startRuntimeHealthReporter({
  exitFn = code => process.exit(code),
  exitOnHighHeap = parseBoolean(process.env.BOTC_RUNTIME_HEALTH_EXIT_ON_HIGH_HEAP),
  gc = global.gc,
  getMemoryUsage = () => process.memoryUsage(),
  highHeapSampleLimit = Number(process.env.BOTC_HEAP_HIGH_SAMPLE_LIMIT) || 3,
  heapUsedWarnBytes = Number(process.env.BOTC_HEAP_WARN_BYTES) || 512 * 1024 * 1024,
  intervalMs = Number(process.env.BOTC_RUNTIME_HEALTH_INTERVAL_MS) || 10 * 60 * 1000,
  logger = console,
  maintenance = runRuntimeMaintenance,
  severeHeapUsedBytes = Number(process.env.BOTC_HEAP_SEVERE_BYTES) || heapUsedWarnBytes * 2,
  setIntervalFn = setInterval
} = {}) {
  const delay = Number(intervalMs)
  if (!Number.isFinite(delay) || delay <= 0) return null
  const state = { highHeapSamples: 0 }

  const timer = setIntervalFn(() => {
    reportRuntimeHealth({
      exitFn,
      exitOnHighHeap,
      gc,
      getMemoryUsage,
      heapUsedWarnBytes,
      highHeapSampleLimit,
      logger,
      maintenance,
      severeHeapUsedBytes,
      state
    })
  }, delay)
  timer?.unref?.()
  return timer
}

function reportRuntimeHealth({
  exitFn = code => process.exit(code),
  exitOnHighHeap = false,
  gc = global.gc,
  getMemoryUsage = () => process.memoryUsage(),
  heapUsedWarnBytes,
  highHeapSampleLimit = 3,
  logger = console,
  maintenance = runRuntimeMaintenance,
  severeHeapUsedBytes = Number(heapUsedWarnBytes || Infinity) * 2,
  state = { highHeapSamples: 0 }
} = {}) {
  const usage = getMemoryUsage()
  if (!usage) return false

  if (Number(usage.heapUsed) < Number(heapUsedWarnBytes || Infinity)) {
    state.highHeapSamples = 0
    return false
  }

  logMessage(
    logger,
    'warn',
    `[BOTC][Runtime] heap usage high: ${formatBytes(usage.heapUsed)} used / ${formatBytes(usage.heapTotal)} heap`
  )
  runMemoryMaintenance({ maintenance, logger })
  runGarbageCollection({ gc, logger })

  const nextUsage = getMemoryUsage() || usage
  if (Number(nextUsage.heapUsed) < Number(heapUsedWarnBytes || Infinity)) {
    state.highHeapSamples = 0
    logMessage(logger, 'info', '[BOTC][Runtime] heap usage recovered after maintenance.')
    return true
  }

  state.highHeapSamples = (state.highHeapSamples || 0) + 1
  maybeExitForSevereHeap({
    exitFn,
    exitOnHighHeap,
    highHeapSampleLimit,
    logger,
    severeHeapUsedBytes,
    state,
    usage: nextUsage
  })
  return true
}

function runMemoryMaintenance({ maintenance, logger }) {
  if (typeof maintenance !== 'function') return null
  try {
    return maintenance()
  } catch (err) {
    logError(logger, '[BOTC][Runtime] memory maintenance failed', err, 'warn')
    return null
  }
}

function runGarbageCollection({ gc, logger }) {
  if (typeof gc !== 'function') return false
  try {
    gc()
    logMessage(logger, 'info', '[BOTC][Runtime] requested garbage collection after high heap usage.')
    return true
  } catch (err) {
    logError(logger, '[BOTC][Runtime] garbage collection failed', err, 'warn')
    return false
  }
}

function maybeExitForSevereHeap({
  exitFn,
  exitOnHighHeap,
  highHeapSampleLimit,
  logger,
  severeHeapUsedBytes,
  state,
  usage
}) {
  if (!exitOnHighHeap) return false
  if (Number(usage.heapUsed) < Number(severeHeapUsedBytes || Infinity)) return false
  if ((state.highHeapSamples || 0) < Number(highHeapSampleLimit || 1)) return false

  logMessage(
    logger,
    'error',
    `[BOTC][Runtime] severe heap usage persisted for ${state.highHeapSamples} checks; exiting for supervisor restart.`
  )
  exitFn(1)
  return true
}

function logError(logger, prefix, err, level = 'error') {
  const details = formatDiagnostic(err)
  logMessage(logger, level, `${prefix}: ${details}`)
}

function logMessage(logger, level, message) {
  if (routeStartupLog(logger, level, message)) return
  writeLog(logger, level, message)
}

function formatDiagnostic(value) {
  if (!value) return 'unknown'
  if (value.stack) return value.stack
  if (value.message) return value.message

  try {
    return JSON.stringify(value)
  } catch (err) {
    return String(value)
  }
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  const mib = bytes / 1024 / 1024
  return `${mib.toFixed(1)} MiB`
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim())
}

module.exports = {
  beginStartupOutput,
  formatBytes,
  formatDiagnostic,
  installClientDiagnostics,
  installProcessDiagnostics,
  loginWithDiagnostics,
  logError,
  logStartupStep,
  parseBoolean,
  reportRuntimeHealth,
  startRuntimeHealthReporter
}
