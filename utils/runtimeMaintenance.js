const {
  sharedDiscordActionQueue
} = require('./discord/actionQueue')
const {
  sharedDiscordActionThrottle
} = require('./discord/actionThrottle')
const {
  sharedInvalidRequestGuard
} = require('./discord/invalidRequestGuard')
const {
  pruneMessageEditSignatures
} = require('./discord/messageActions')
const {
  createBotLogger,
  getDefaultLogger
} = require('./logger')

const maintenanceTasks = new Map()

function runRuntimeMaintenance({ logger = getDefaultLogger(), now = Date.now() } = {}) {
  const log = createBotLogger({ logger, subsystem: 'RuntimeMaintenance' })
  const errors = []
  const result = {
    registeredTasks: [...maintenanceTasks.keys()].sort()
  }
  assignMaintenanceResult(result, errors, log, 'actionQueue', () => sharedDiscordActionQueue.snapshot())
  assignMaintenanceResult(result, errors, log, 'actionThrottle', () => ({
    removed: sharedDiscordActionThrottle.prune(now),
    size: sharedDiscordActionThrottle.size()
  }))
  assignMaintenanceResult(result, errors, log, 'invalidRequests', () => sharedInvalidRequestGuard.snapshot(now))
  assignMaintenanceResult(result, errors, log, 'messageEditSignatures', () => pruneMessageEditSignatures({ now }))
  for (const [name, task] of maintenanceTasks.entries()) {
    assignMaintenanceResult(result, errors, log, name, () => task({ now }))
  }
  if (errors.length) result.errors = errors
  return result
}

function registerRuntimeMaintenanceTask(name, task) {
  if (!name || typeof task !== 'function') return () => {}
  const taskName = String(name)
  maintenanceTasks.set(taskName, task)
  return () => {
    if (maintenanceTasks.get(taskName) === task) maintenanceTasks.delete(taskName)
  }
}

function assignMaintenanceResult(result, errors, log, name, task) {
  try {
    result[name] = task()
  } catch (err) {
    const message = formatMaintenanceError(err)
    result[name] = { failed: true, error: message }
    errors.push({ task: name, message })
    log.recoverable('task_failed', err, { task: name })
  }
}

function formatMaintenanceError(error) {
  if (!error) return 'unknown error'
  const code = error.code ?? error.status ?? error.statusCode ?? error.rawError?.code
  const message = error.message || error.rawError?.message || String(error)
  return code ? `${message} (code=${code})` : message
}

module.exports = {
  registerRuntimeMaintenanceTask,
  runRuntimeMaintenance
}
