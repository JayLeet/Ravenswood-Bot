const {
  createBotLogger
} = require('./logger')

const log = createBotLogger({ subsystem: 'Setup' })

function logSetupRecoverable(action, err, context = {}, fallback = null) {
  log.recoverable(action, err, context)
  return fallback
}

module.exports = {
  logSetupRecoverable
}
