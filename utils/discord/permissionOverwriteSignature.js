const {
  setPermissionOverwritesIfChanged: setPermissionOverwritesWithActions
} = require('./permissionOverwriteActions')

function createPermissionOverwriteSignature(overwrites = []) {
  return JSON.stringify(normalizePermissionOverwrites(overwrites))
}

function normalizePermissionOverwrites(overwrites = []) {
  return [...toOverwriteArray(overwrites)]
    .map(normalizePermissionOverwrite)
    .filter(Boolean)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
}

function toOverwriteArray(overwrites) {
  if (!overwrites) return []
  if (Array.isArray(overwrites)) return overwrites
  if (typeof overwrites.values === 'function') return [...overwrites.values()]
  if (typeof overwrites.cache?.values === 'function') return [...overwrites.cache.values()]
  if (Array.isArray(overwrites.cache)) return overwrites.cache
  return []
}

function normalizePermissionOverwrite(overwrite) {
  const id = overwrite?.id
  if (!id) return null

  return {
    id: String(id),
    allow: normalizePermissionSet(overwrite.allow),
    deny: normalizePermissionSet(overwrite.deny),
    type: overwrite.type ?? null
  }
}

function normalizePermissionSet(value) {
  if (!value) return []
  if (typeof value.toArray === 'function') return value.toArray().map(String).sort()
  if (Array.isArray(value)) return value.map(String).sort()
  if (typeof value.bitfield !== 'undefined') return [String(value.bitfield)]
  return [String(value)]
}

function permissionOverwritesEqual(left, right) {
  return createPermissionOverwriteSignature(left) === createPermissionOverwriteSignature(right)
}

function setPermissionOverwritesIfChanged(channel, overwrites, reason) {
  return setPermissionOverwritesWithActions(channel, overwrites, reason)
}

module.exports = {
  createPermissionOverwriteSignature,
  normalizePermissionOverwrites,
  permissionOverwritesEqual,
  setPermissionOverwritesIfChanged
}
