const VALID_TEAMS = new Set(['townsfolk', 'outsider', 'minion', 'demon'])
const BEHAVIOR_HOOKS = [
  'condition',
  'executionShield',
  'modifyVote',
  'onDeath',
  'onExecution',
  'onNight',
  'onNightStart',
  'onPhaseStart'
]

function validateScript(script) {
  const errors = []
  const label = getScriptLabel(script)

  if (!isPlainObject(script)) {
    return { ok: false, errors: ['Script must be an object.'] }
  }

  validateScriptIdentity(script, errors)
  const roleIds = validateRoles(script.roles, errors, label)
  validateSetup(script.setup, script.id, errors, label)
  validateNightOrder(script.nightOrder, roleIds, errors, label)
  validateBehaviors(script.behaviors, roleIds, errors, `${label}.behaviors`)

  return { ok: errors.length === 0, errors }
}

function validateScripts(scripts, options = {}) {
  const errors = []
  const seen = new Set()

  if (!Array.isArray(scripts) || scripts.length === 0) {
    return { ok: false, errors: ['At least one script is required.'] }
  }

  for (const script of scripts) {
    const result = validateScript(script)
    errors.push(...result.errors)

    if (!script?.id) continue
    if (seen.has(script.id)) errors.push(`Duplicate script id: ${script.id}`)
    seen.add(script.id)
  }

  if (options.defaultScriptId && !seen.has(options.defaultScriptId)) {
    errors.push(`Default script is missing: ${options.defaultScriptId}`)
  }

  return { ok: errors.length === 0, errors }
}

function assertValidScripts(scripts, options = {}) {
  const result = validateScripts(scripts, options)
  if (result.ok) return scripts

  throw new Error(`Invalid script registry:\n- ${result.errors.join('\n- ')}`)
}

function validateScriptIdentity(script, errors) {
  if (!isSlug(script.id)) errors.push('Script id must be a non-empty kebab-case string.')
  if (!isNonEmptyString(script.name)) errors.push(`Script ${script.id || '<unknown>'} needs a name.`)
}

function validateRoles(roles, errors, label) {
  const roleIds = new Set()

  if (!Array.isArray(roles) || roles.length === 0) {
    errors.push(`${label}.roles must contain at least one role.`)
    return roleIds
  }

  for (const role of roles) {
    if (!isPlainObject(role)) {
      errors.push(`${label}.roles contains a non-object role.`)
      continue
    }

    if (!isRoleId(role.id)) errors.push(`${label}.roles has an invalid role id: ${role.id}`)
    if (roleIds.has(role.id)) errors.push(`${label}.roles has duplicate role id: ${role.id}`)
    if (!isNonEmptyString(role.name)) errors.push(`${label}.${role.id || '<unknown>'} needs a name.`)
    if (!VALID_TEAMS.has(role.team)) errors.push(`${label}.${role.id || '<unknown>'} has invalid team: ${role.team}`)
    if (role.ability !== null && role.ability !== undefined && typeof role.ability !== 'string') {
      errors.push(`${label}.${role.id || '<unknown>'}.ability must be a string or null.`)
    }

    if (role.id) roleIds.add(role.id)
    if (role.behaviors) validateBehaviors({ [role.id]: role.behaviors }, roleIds, errors, `${label}.roles`)
  }

  return roleIds
}

function validateSetup(setup, scriptId, errors, label) {
  if (!isPlainObject(setup)) {
    errors.push(`${label}.setup must be an object.`)
    return
  }

  if (setup.id !== scriptId) errors.push(`${label}.setup.id must match script id.`)
  if (!isNonEmptyString(setup.name)) errors.push(`${label}.setup.name is required.`)
}

function validateNightOrder(nightOrder, roleIds, errors, label) {
  if (!isPlainObject(nightOrder)) {
    errors.push(`${label}.nightOrder must be an object.`)
    return
  }

  for (const key of ['firstNight', 'otherNights']) {
    validateRoleIdList(nightOrder[key], roleIds, errors, `${label}.nightOrder.${key}`)
  }
}

function validateRoleIdList(values, roleIds, errors, label) {
  if (!Array.isArray(values)) {
    errors.push(`${label} must be an array.`)
    return
  }

  const seen = new Set()
  for (const roleId of values) {
    if (!roleIds.has(roleId)) errors.push(`${label} references unknown role: ${roleId}`)
    if (seen.has(roleId)) errors.push(`${label} contains duplicate role: ${roleId}`)
    seen.add(roleId)
  }
}

function validateBehaviors(behaviors, roleIds, errors, label) {
  if (!behaviors) return
  if (!isPlainObject(behaviors)) {
    errors.push(`${label} must be an object.`)
    return
  }

  for (const [roleId, behavior] of Object.entries(behaviors)) {
    if (!roleIds.has(roleId)) errors.push(`${label} references unknown role: ${roleId}`)
    validateBehaviorDefinition(behavior, errors, `${label}.${roleId}`)
  }
}

function validateBehaviorDefinition(behavior, errors, label) {
  if (!isPlainObject(behavior)) {
    errors.push(`${label} must be an object.`)
    return
  }

  validateNightAction(behavior.nightAction, errors, `${label}.nightAction`)
  for (const hook of BEHAVIOR_HOOKS) validateOptionalFunction(behavior[hook], errors, `${label}.${hook}`)

  if (
    behavior.preventsDemonKill !== undefined &&
    typeof behavior.preventsDemonKill !== 'boolean'
  ) {
    errors.push(`${label}.preventsDemonKill must be boolean.`)
  }
}

function validateNightAction(nightAction, errors, label) {
  if (!nightAction) return
  if (!isPlainObject(nightAction)) {
    errors.push(`${label} must be an object.`)
    return
  }

  if (
    nightAction.targetCount !== undefined &&
    (!Number.isInteger(nightAction.targetCount) || nightAction.targetCount < 1)
  ) {
    errors.push(`${label}.targetCount must be a positive integer.`)
  }

  if (nightAction.allowSelf !== undefined && typeof nightAction.allowSelf !== 'boolean') {
    errors.push(`${label}.allowSelf must be boolean.`)
  }

  validateOptionalFunction(nightAction.condition, errors, `${label}.condition`)
}

function validateOptionalFunction(value, errors, label) {
  if (value !== undefined && typeof value !== 'function') errors.push(`${label} must be a function.`)
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function isRoleId(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value)
}

function getScriptLabel(script) {
  return `script:${script?.id || '<unknown>'}`
}

module.exports = {
  assertValidScripts,
  validateScript,
  validateScripts
}
