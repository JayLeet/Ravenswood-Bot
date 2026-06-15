async function runRecoverableBoolean(log, action, fn, context = {}) {
  try {
    return Boolean(await fn())
  } catch (err) {
    log?.recoverable?.(action, err, context)
    return false
  }
}

async function runRecoverableNull(log, action, fn, context = {}) {
  try {
    return await fn() || null
  } catch (err) {
    log?.recoverable?.(action, err, context)
    return null
  }
}

function createMemberContext(member, context = {}) {
  return {
    guildId: member?.guild?.id || member?.guildId,
    userId: member?.id,
    ...context
  }
}

function createMemberRoleContext(member, role, context = {}) {
  return {
    ...createMemberContext(member, context),
    roleId: role?.id,
    roleName: role?.name
  }
}

module.exports = {
  createMemberContext,
  createMemberRoleContext,
  runRecoverableBoolean,
  runRecoverableNull
}
