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

function queuedMemberNicknameSet(member, nickname) {
  const key = createMemberActionQueueKey('nickname-set', member)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getMemberTarget(member)
    if (!member?.manageable || typeof member.setNickname !== 'function') {
      sharedDiscordApiMetrics.skipped('nickname-set', { target })
      return false
    }

    if ((member.displayName || member.user?.username) === nickname) {
      sharedDiscordApiMetrics.skipped('nickname-set', { target })
      return true
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMemberAction('nickname-set', target, async () => {
      await member.setNickname(nickname)
      return true
    })
  })
}

function queuedMemberRoleAdd(member, role) {
  return queuedMemberRoleWrite('role-add', member, role, () => member.roles.add(role))
}

function queuedMemberRoleRemove(member, role) {
  return queuedMemberRoleWrite('role-remove', member, role, () => member.roles.remove(role))
}

function queuedRoleColorEdit(role, color, reason) {
  const key = createRoleActionQueueKey('role-color', role)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getRoleTarget(role)
    if (!color || getRolePrimaryColor(role) === color || typeof role?.edit !== 'function') {
      sharedDiscordApiMetrics.skipped('role-color', { target })
      return true
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMemberAction('role-color', target, async () => {
      await role.edit(createRoleColorPatch(color), reason)
      return true
    })
  })
}

function createRoleColorPatch(color) {
  return { colors: { primaryColor: color } }
}

function getRolePrimaryColor(role) {
  return role?.colors?.primaryColor ?? role?.color ?? null
}

function queuedRolePermissionsEdit(role, permissions, reason) {
  const key = createRoleActionQueueKey('role-permissions', role)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getRoleTarget(role)
    if (typeof role?.edit !== 'function') {
      sharedDiscordApiMetrics.skipped('role-permissions', { target })
      return false
    }

    const current = normalizePermissionValue(role.permissions?.bitfield ?? role.permissions ?? 0n)
    const desired = normalizePermissionValue(permissions)
    if (current === desired) {
      sharedDiscordApiMetrics.skipped('role-permissions', { target })
      return true
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMemberAction('role-permissions', target, async () => {
      await role.edit({ permissions: desired }, reason)
      return true
    })
  })
}

function queuedRolePositionSet(role, position) {
  const key = createRoleActionQueueKey('role-position', role)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getRoleTarget(role)
    if (role?.position === position) {
      sharedDiscordApiMetrics.skipped('role-position', { target })
      return true
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMemberAction('role-position', target, async () => {
      await role.setPosition(position)
      return true
    })
  })
}

function queuedMemberRoleWrite(action, member, role, write) {
  const key = createMemberRoleActionQueueKey(member)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getMemberRoleTarget(member, role)
    if (!role || !member?.roles?.cache || typeof write !== 'function') {
      sharedDiscordApiMetrics.skipped(action, { target })
      return false
    }

    const hasRole = member.roles.cache.has(role.id)
    if ((action === 'role-add' && hasRole) || (action === 'role-remove' && !hasRole)) {
      sharedDiscordApiMetrics.skipped(action, { target })
      return true
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMemberAction(action, target, async () => {
      await write()
      return true
    })
  })
}

function normalizePermissionValue(value) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  if (typeof value === 'string') return BigInt(value)
  return BigInt(value || 0)
}

async function runMeasuredMemberAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, { metrics: sharedDiscordApiMetrics })
}

function createMemberActionQueueKey(action, member) {
  return [action, getGuildId(member), member?.id || 'unknown-member'].join(':')
}

function createMemberRoleActionQueueKey(member) {
  return createMemberActionQueueKey('member-role-write', member)
}

function createRoleActionQueueKey(action, role) {
  return ['role-write', getGuildId(role), role?.id || 'unknown-role'].join(':')
}

function getMemberTarget(member) {
  return [getGuildId(member), member?.id || 'unknown-member'].join(':')
}

function getMemberRoleTarget(member, role) {
  return [getMemberTarget(member), role?.id || 'unknown-role'].join(':')
}

function getRoleTarget(role) {
  return [getGuildId(role), role?.id || 'unknown-role'].join(':')
}

function getGuildId(target) {
  return target?.guildId || target?.guild?.id || 'unknown-guild'
}

module.exports = {
  createMemberRoleActionQueueKey,
  createRoleActionQueueKey,
  queuedMemberNicknameSet,
  queuedMemberRoleAdd,
  queuedMemberRoleRemove,
  queuedRoleColorEdit,
  queuedRolePermissionsEdit,
  queuedRolePositionSet,
}
