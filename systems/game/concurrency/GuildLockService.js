const { AsyncLocalStorage } = require('async_hooks')

class GuildLockService {
  constructor() {
    this.tails = new Map()
    this.storage = new AsyncLocalStorage()
  }

  async run(guildId, task) {
    const key = String(guildId || 'global')
    const held = this.storage.getStore()

    if (held?.has(key)) return task()

    const previous = this.tails.get(key) || Promise.resolve()
    let release = null
    const current = new Promise(resolve => {
      release = resolve
    })
    const tail = previous.catch(() => {}).then(() => current)

    this.tails.set(key, tail)
    await previous.catch(() => {})

    const nextHeld = new Set(held || [])
    nextHeld.add(key)

    try {
      return await this.storage.run(nextHeld, task)
    } finally {
      release()
      if (this.tails.get(key) === tail) this.tails.delete(key)
    }
  }
}

module.exports = GuildLockService
