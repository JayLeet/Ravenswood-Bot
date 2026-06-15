let activeStartupOutput = null

function beginStartupOutput({
  logger = console,
  verbose = parseBoolean(process.env.BOTC_STARTUP_VERBOSE)
} = {}) {
  const entries = []
  let done = false
  const output = {
    fail,
    logger: {
      error: message => record('error', message),
      info: message => record('info', message),
      log: message => record('info', message),
      milestone: message => record('milestone', message),
      warn: message => record('warn', message)
    },
    record,
    succeed
  }

  activeStartupOutput = output
  return output

  function record(level, message) {
    const line = String(message)
    if (done) {
      if (level === 'milestone') return
      writeLog(logger, level, line)
      return
    }

    entries.push({ level, message: line })
    if (verbose) writeLog(logger, getLiveLevel(level), line)
  }

  function succeed(message = 'Ready.') {
    if (done) return false
    done = true
    clearActive(output)
    writeLog(logger, 'info', formatStartupMessage(message))
    if (!verbose) flushDiagnostics(entries, logger)
    return true
  }

  function fail(err, prefix = '[BOTC][Startup] Startup failed') {
    if (done) return false
    done = true
    clearActive(output)
    writeLog(logger, 'error', `${prefix}: ${formatDiagnostic(err)}`)
    if (!verbose) flushTimeline(entries, logger)
    return true
  }
}

function routeStartupLog(logger, level, message) {
  if (!activeStartupOutput) return false
  if (logger !== console && logger !== activeStartupOutput.logger) return false

  activeStartupOutput.record(level, message)
  return true
}

function flushDiagnostics(entries, logger) {
  for (const entry of entries) {
    if (!['error', 'warn'].includes(entry.level)) continue
    writeLog(logger, entry.level, entry.message)
  }
}

function flushTimeline(entries, logger) {
  if (!entries.length) return
  writeLog(logger, 'error', '[BOTC][Startup] Startup timeline before failure:')
  for (const entry of entries) {
    const level = ['info', 'milestone'].includes(entry.level) ? 'error' : entry.level
    writeLog(logger, level, `  - ${entry.message}`)
  }
}

function clearActive(output) {
  if (activeStartupOutput === output) activeStartupOutput = null
}

function formatStartupMessage(message) {
  const line = String(message)
  return line.startsWith('[BOTC][Startup]') ? line : `[BOTC][Startup] ${line}`
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

function writeLog(logger, level, message) {
  const fallback = console[level] || console.log
  const fn = typeof logger?.[level] === 'function' ? logger[level] : fallback
  fn.call(logger || console, message)
}

function getLiveLevel(level) {
  return level === 'milestone' ? 'info' : level
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim())
}

module.exports = {
  beginStartupOutput,
  routeStartupLog,
  writeLog
}
