const {
  sharedDiscordActionQueue
} = require('./actionQueue')
const {
  sharedDiscordActionThrottle
} = require('./actionThrottle')
const {
  sharedDiscordApiMetrics
} = require('./apiMetrics')
const {
  runMeasuredDiscordAction
} = require('./measuredAction')
const {
  findCacheValue
} = require('./cacheValues')

function queuedGuildRoleCreate(guild, options) {
  const key = createGuildRoleCreateQueueKey(guild, options?.name)
  return sharedDiscordActionQueue.run(key, async () => {
    const existing = findCachedGuildRoleByName(guild, options?.name)
    if (existing) {
      sharedDiscordApiMetrics.skipped('role-create', {
        reason: 'role-exists',
        target: key
      })
      return existing
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredRoleAction('role-create', key, () =>
      guild.roles.create(createSafeRoleCreateOptions(guild, options))
    )
  })
}

function createSafeRoleCreateOptions(guild, options = {}) {
  const safeOptions = createRoleCreateColorOptions(options)
  if (Number.isFinite(safeOptions.position)) return safeOptions
  const botPosition = guild?.members?.me?.roles?.highest?.position
  if (!Number.isFinite(botPosition) || botPosition <= 1) return safeOptions
  return { ...safeOptions, position: botPosition - 1 }
}

function createRoleCreateColorOptions(options) {
  if (!Object.prototype.hasOwnProperty.call(options, 'color')) return options

  const { color, colors, ...rest } = options
  if (colors !== undefined && colors !== null) return { ...rest, colors }
  if (color === undefined || color === null) return rest
  return {
    ...rest,
    colors: { primaryColor: color }
  }
}

async function runMeasuredRoleAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, { metrics: sharedDiscordApiMetrics })
}

function createGuildRoleCreateQueueKey(guild, roleName = 'unknown-role') {
  return [
    'role-create',
    guild?.id || 'unknown-guild',
    String(roleName || 'unknown-role')
  ].join(':')
}

function findCachedGuildRoleByName(guild, roleName) {
  if (!roleName) return null
  return findCacheValue(guild?.roles?.cache, role => role?.name === roleName)
}

module.exports = {
  createSafeRoleCreateOptions,
  createRoleCreateColorOptions,
  queuedGuildRoleCreate
}
