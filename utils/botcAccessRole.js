const {
  queuedRoleColorEdit,
  queuedRolePermissionsEdit
} = require('./discord/memberActions')
const {
  queuedGuildRoleCreate
} = require('./discord/roleActions')
const { createBotLogger } = require('./logger')

const BOTC_ACCESS_ROLE_NAME = '🩸 Blood on the Clocktower'
const BOTC_ACCESS_ROLE_COLOR = 0x8B0000
const BOTC_ACCESS_ROLE_COLOR_REASON = 'BOTC access role dark red color'
const BOTC_ACCESS_ROLE_PERMISSIONS = 0n
const BOTC_ACCESS_ROLE_PERMISSIONS_REASON = 'BOTC access role base permissions reset'
const log = createBotLogger({ subsystem: 'BotcAccessRole' })

async function ensureBotcAccessRole(guild) {
  await refreshGuildRoles(guild)
  const existing = findBotcAccessRole(guild)
  if (existing) {
    await refreshBotcAccessRole(existing)
    return existing
  }

  return queuedGuildRoleCreate(guild, {
    name: BOTC_ACCESS_ROLE_NAME,
    color: BOTC_ACCESS_ROLE_COLOR,
    permissions: BOTC_ACCESS_ROLE_PERMISSIONS,
    reason: 'BOTC optional access role for private setup channels'
  }).catch(err => {
    log.recoverable('create-access-role', err, { guildId: guild?.id })
    return null
  })
}

async function refreshBotcAccessRole(role) {
  await queuedRoleColorEdit(role, BOTC_ACCESS_ROLE_COLOR, BOTC_ACCESS_ROLE_COLOR_REASON).catch(err => {
    log.recoverable('refresh-access-role-color', err, { guildId: role?.guild?.id || role?.guildId, roleId: role?.id })
    return false
  })
  await queuedRolePermissionsEdit(role, BOTC_ACCESS_ROLE_PERMISSIONS, BOTC_ACCESS_ROLE_PERMISSIONS_REASON).catch(err => {
    log.recoverable('refresh-access-role-permissions', err, { guildId: role?.guild?.id || role?.guildId, roleId: role?.id })
    return false
  })
}

async function refreshGuildRoles(guild) {
  try {
    await guild.roles.fetch?.()
  } catch (err) {
    log.recoverable('refresh-guild-roles', err, { guildId: guild?.id })
  }
}

function findBotcAccessRole(guild) {
  return getCachedRoles(guild).find(role => role.name === BOTC_ACCESS_ROLE_NAME) || null
}

function getCachedRoles(guild) {
  const cache = guild?.roles?.cache
  if (!cache) return []
  if (Array.isArray(cache)) return cache
  if (typeof cache.values === 'function') return [...cache.values()]
  if (typeof cache[Symbol.iterator] === 'function') return [...cache]
  if (typeof cache.find === 'function') return { find: predicate => cache.find(predicate) || null }
  return Object.values(cache)
}

module.exports = {
  BOTC_ACCESS_ROLE_COLOR,
  BOTC_ACCESS_ROLE_NAME,
  BOTC_ACCESS_ROLE_PERMISSIONS,
  ensureBotcAccessRole,
  findBotcAccessRole,
  getCachedRoles,
  refreshBotcAccessRole
}
