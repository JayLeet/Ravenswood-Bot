function recordNightDeath(game, playerId, source = 'night_action') {
  if (game.phase !== 'night' || !playerId) return null

  game.pendingNightDeaths ??= []
  const existing = game.pendingNightDeaths.find(death =>
    death.playerId === playerId &&
    death.day === game.day &&
    !death.announcedAt
  )
  if (existing) return existing

  const death = {
    playerId,
    day: game.day || 1,
    source,
    createdAt: Date.now()
  }
  game.pendingNightDeaths.push(death)
  return death
}

function createDawnDeathNotices(manager, game) {
  const deaths = (game.pendingNightDeaths || [])
    .filter(death => death.day === (game.day || 1))
    .filter(death => !death.announcedAt)

  for (const death of deaths) death.announcedAt = Date.now()
  return deaths.map(death => createDawnDeathNotice(manager, game, death.playerId))
}

function createDawnDeathNotice(manager, game, playerId) {
  const label = manager.getDisplayName(game, playerId) || `<@${playerId}>`
  return {
    color: 0x2c3e50,
    description: 'They died in the night.',
    title: `We found ${label}'s dead body...`
  }
}

module.exports = {
  createDawnDeathNotices,
  recordNightDeath
}
