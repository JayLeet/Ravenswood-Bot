const {
  assertValidScripts,
  validateScript,
  validateScripts
} = require('./validation')
const {
  applyOfficialAbility
} = require('./officialAbilities')

/** @type {import('../types').ScriptDefinition[]} */
const rawScripts = [
  require('./bad-moon-rising'),
  require('./sects-violets'),
  require('./trouble-brewing')
]

const DEFAULT_SCRIPT_ID = 'trouble-brewing'
assertValidScripts(rawScripts, { defaultScriptId: DEFAULT_SCRIPT_ID })

const scripts = rawScripts
  .map(script => normalizeScript(script))
  .sort((a, b) => a.name.localeCompare(b.name))
const scriptMap = new Map(scripts.map(script => [script.id, normalizeScript(script)]))

/**
 * @param {import('../types').ScriptDefinition} script
 * @returns {import('../types').ScriptDefinition}
 */
function normalizeScript(script) {
  return {
    ...script,
    behaviors: { ...(script.behaviors || {}) },
    roles: script.roles.map(applyOfficialAbility),
    setup: { ...script.setup },
    nightOrder: {
      firstNight: [...(script.nightOrder?.firstNight || [])],
      otherNights: [...(script.nightOrder?.otherNights || [])]
    }
  }
}

/** @returns {import('../types').ScriptListItem[]} */
function listScripts() {
  return scripts.map(script => ({
    id: script.id,
    name: script.name,
    edition: script.setup?.edition || 'custom',
    recommendedFor: script.setup?.recommendedFor || null,
    supportStatus: script.setup?.supportStatus || 'partial',
    supportNote: script.setup?.supportNote || null
  }))
}

/**
 * @param {unknown} value
 * @returns {import('../types').ScriptId | null}
 */
function normalizeScriptId(value) {
  const raw = String(value || '').trim()
  if (!raw) return DEFAULT_SCRIPT_ID

  const canonical = raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (scriptMap.has(canonical)) return canonical

  const found = scripts.find(script =>
    script.name.toLowerCase() === raw.toLowerCase() ||
    script.id === raw
  )

  return found?.id || null
}

/**
 * @param {unknown} value
 * @returns {import('../types').ScriptDefinition | null}
 */
function getScript(value) {
  const scriptId = normalizeScriptId(value)
  if (!scriptId) return null
  return scriptMap.get(scriptId) || null
}

/** @returns {import('../types').ScriptDefinition} */
function getDefaultScript() {
  return getScript(DEFAULT_SCRIPT_ID)
}

/**
 * @param {unknown} value
 * @returns {import('../types').RoleCategories}
 */
function createRoleCategories(value) {
  const script = getScript(value) || getDefaultScript()
  const categories = {
    townsfolk: [],
    outsider: [],
    minion: [],
    demon: []
  }

  for (const role of script.roles) {
    if (!categories[role.team]) categories[role.team] = []
    categories[role.team].push(role.id)
  }

  return categories
}

/**
 * @param {unknown} value
 * @returns {import('../types').RoleId[]}
 */
function getRoleIds(value) {
  const script = getScript(value) || getDefaultScript()
  return script.roles.map(role => role.id)
}

/**
 * @param {unknown} value
 * @param {import('../types').RoleId} roleId
 * @returns {import('../types').ScriptRole | null}
 */
function getRole(value, roleId) {
  const script = getScript(value) || getDefaultScript()
  return script.roles.find(role => role.id === roleId) || null
}

function findRole(value, query) {
  const script = getScript(value) || getDefaultScript()
  const normalized = normalizeRoleQuery(query)
  if (!normalized) return null

  return script.roles.find(role =>
    normalizeRoleQuery(role.id) === normalized ||
    normalizeRoleQuery(role.name) === normalized
  ) || null
}

function normalizeRoleQuery(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * @param {unknown} value
 * @param {import('../types').RoleId} roleId
 * @returns {import('../types').RoleBehaviorDefinition | null}
 */
function getRoleBehavior(value, roleId) {
  const script = getScript(value) || getDefaultScript()
  return script.behaviors?.[roleId] || null
}

/**
 * @param {unknown} value
 * @returns {import('../types').RoleNameMap}
 */
function getRoleNameMap(value) {
  const script = getScript(value) || getDefaultScript()
  return Object.fromEntries(script.roles.map(role => [role.id, role.name]))
}

module.exports = {
  DEFAULT_SCRIPT_ID,
  createRoleCategories,
  findRole,
  getDefaultScript,
  getRole,
  getRoleBehavior,
  getRoleIds,
  getRoleNameMap,
  getScript,
  listScripts,
  normalizeScriptId,
  validateScript,
  validateScripts
}
