const {
  createBotLogger
} = require('../../../utils/logger')

class EventBus {
  constructor({ logger = undefined } = {}) {
    this.listeners = {}
    this.log = createBotLogger({ logger, subsystem: 'GameEvents' })
  }

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  getRuntimeState() {
    const byEvent = {}
    let total = 0

    for (const [event, handlers] of Object.entries(this.listeners)) {
      const count = Array.isArray(handlers) ? handlers.length : 0
      byEvent[event] = count
      total += count
    }

    return { byEvent, total }
  }

  async emit(event, payload) {
    const handlers = this.listeners[event] || []
    const errors = []

    for (const [index, fn] of handlers.entries()) {
      try {
        const result = await fn(payload)
        if (result === false) return { blocked: true, errors }
      } catch (err) {
        errors.push({ event, index, message: formatEventError(err) })
        this.log.recoverable('listener-failed', err, {
          event,
          guildId: payload?.game?.guildId || payload?.guildId,
          listenerIndex: index
        })
      }
    }

    return errors.length ? { blocked: false, errors } : { blocked: false }
  }
}

function formatEventError(error) {
  if (!error) return 'unknown error'
  return error.message || String(error)
}

module.exports = EventBus
