const DEFAULT_VOTE_BUTTON_COOLDOWN_MS = 1000

function createVoteButtonCooldown({
  cooldownMs = DEFAULT_VOTE_BUTTON_COOLDOWN_MS,
  now = Date.now
} = {}) {
  const entries = new Map()

  function acquire(interaction) {
    const key = getVoteButtonCooldownKey(interaction)
    if (!key) return { ok: true, token: null }

    const currentTime = now()
    prune(currentTime)

    const entry = entries.get(key)
    if (entry?.inFlight || (entry?.nextAllowedAt || 0) > currentTime) {
      return {
        ok: false,
        remainingMs: Math.max(1, (entry?.nextAllowedAt || currentTime + cooldownMs) - currentTime)
      }
    }

    const token = { key }
    entries.set(key, {
      inFlight: true,
      nextAllowedAt: currentTime + cooldownMs,
      token
    })

    return { ok: true, token }
  }

  function release(token, { keepCooldown = true } = {}) {
    if (!token?.key) return
    const entry = entries.get(token.key)
    if (!entry || entry.token !== token) return

    if (!keepCooldown) {
      entries.delete(token.key)
      return
    }

    entries.set(token.key, {
      inFlight: false,
      nextAllowedAt: entry.nextAllowedAt,
      token: null
    })
  }

  function prune(currentTime = now()) {
    let removed = 0
    for (const [key, entry] of entries.entries()) {
      if (entry.inFlight || (entry.nextAllowedAt || 0) > currentTime) continue
      entries.delete(key)
      removed += 1
    }
    return removed
  }

  function clear() {
    entries.clear()
  }

  function size() {
    return entries.size
  }

  return {
    acquire,
    clear,
    prune,
    release,
    size
  }
}

function getVoteButtonCooldownKey(interaction) {
  const guildId = interaction.guild?.id || interaction.guildId || 'dm'
  const userId = interaction.user?.id || interaction.member?.user?.id || interaction.member?.id
  if (!userId) return null
  return `${guildId}:${userId}`
}

module.exports = {
  createVoteButtonCooldown
}
