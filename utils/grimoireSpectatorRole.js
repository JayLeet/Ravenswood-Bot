const { createBotLogger } = require('./logger')
const {
  queuedGuildRoleCreate
} = require('./discord/roleActions')

const GRIMOIRE_SPECTATOR_ROLE_NAME = '\u{1F441}\u{FE0F}\u{1F50E} Spectator'
const log = createBotLogger({ subsystem: 'GrimoireSpectatorRole' })

async function ensureGrimoireSpectatorRole(guild) {
  const existing = findGrimoireSpectatorRole(guild)
  if (existing) return existing

  return queuedGuildRoleCreate(guild, {
    name: GRIMOIRE_SPECTATOR_ROLE_NAME,
    reason: 'BOTC grimoire spectator role'
  }).catch(err => {
    log.recoverable('create-grimoire-spectator-role', err, { guildId: guild?.id })
    return null
  })
}

function findGrimoireSpectatorRole(guild) {
  return guild?.roles?.cache?.find?.(role =>
    role.name === GRIMOIRE_SPECTATOR_ROLE_NAME
  ) || null
}

module.exports = {
  GRIMOIRE_SPECTATOR_ROLE_NAME,
  ensureGrimoireSpectatorRole,
  findGrimoireSpectatorRole
}
