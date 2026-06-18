const {
  PermissionFlagsBits
} = require('discord.js')

function hasPermissionBit(bitfield, bit) {
  return bit !== 0n && (bitfield & bit) === bit
}

function normalizePermissionBitfield(value) {
  const bitfield = value?.bitfield ?? value
  if (bitfield === null || bitfield === undefined) return 0n

  if (Array.isArray(bitfield)) {
    return bitfield.reduce((combined, entry) => combined | normalizePermissionBitfield(entry), 0n)
  }

  if (typeof bitfield === 'string') {
    const namedBit = PermissionFlagsBits[bitfield]
    if (namedBit !== undefined) return normalizePermissionBitfield(namedBit)
  }

  try {
    return BigInt(bitfield)
  } catch {
    return 0n
  }
}

function permissionSetIncludes(value, flag) {
  if (!value) return false
  if (typeof value.has === 'function') return value.has(flag)
  if (typeof value.includes === 'function') return value.includes(flag)
  if (Array.isArray(value)) return value.includes(flag)
  const bitfield = value.bitfield ?? value
  try {
    return (BigInt(bitfield) & BigInt(flag)) === BigInt(flag)
  } catch {
    return false
  }
}

module.exports = {
  hasPermissionBit,
  normalizePermissionBitfield,
  permissionSetIncludes
}
