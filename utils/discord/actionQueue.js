function createDiscordActionQueue() {
  const tails = new Map()

  async function run(key, action) {
    const queueKey = String(key || 'global')
    const previous = tails.get(queueKey) || Promise.resolve()
    let releaseTail
    const tail = new Promise(resolve => { releaseTail = resolve })

    tails.set(queueKey, tail)

    try {
      await previous.catch(() => null)
      return await action()
    } finally {
      if (tails.get(queueKey) === tail) tails.delete(queueKey)
      releaseTail()
    }
  }

  function size() {
    return tails.size
  }

  function snapshot({ limit = 10 } = {}) {
    const keys = [...tails.keys()].slice(0, Math.max(0, Number(limit) || 0))
    return {
      keys,
      overflow: Math.max(0, tails.size - keys.length),
      size: tails.size
    }
  }

  return {
    run,
    snapshot,
    size
  }
}

const sharedDiscordActionQueue = createDiscordActionQueue()

module.exports = {
  createDiscordActionQueue,
  sharedDiscordActionQueue
}
