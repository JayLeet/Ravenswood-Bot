function coerceArrayFields(target, fields, context) {
  for (const field of fields) {
    if (target[field] === undefined || target[field] === null) {
      target[field] = []
      continue
    }
    if (Array.isArray(target[field])) continue
    warn(context.logger, 'repair-persisted-array-field', 'Persisted array field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
    target[field] = []
  }
}

function coerceObjectFields(target, fields, context) {
  for (const field of fields) {
    if (target[field] === undefined || target[field] === null) {
      target[field] = {}
      continue
    }
    if (isPlainObject(target[field])) continue
    warn(context.logger, 'repair-persisted-object-field', 'Persisted object field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
    target[field] = {}
  }
}

function coerceBooleanField(target, field, fallback, context) {
  if (target[field] === undefined || target[field] === null) {
    target[field] = fallback
    return
  }
  if (typeof target[field] === 'boolean') return
  warn(context.logger, 'repair-persisted-boolean-field', 'Persisted boolean field had the wrong shape.', {
    field,
    guildId: context.guildId,
    recordType: context.recordType
  })
  target[field] = fallback
}

function coerceNullableObjectFields(target, fields, context) {
  for (const field of fields) {
    if (target[field] === undefined || target[field] === null) {
      target[field] = null
      continue
    }
    if (isPlainObject(target[field])) continue
    warn(context.logger, 'repair-persisted-nullable-object-field', 'Persisted nullable object field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
    target[field] = null
  }
}

function coerceNullableStringFields(target, fields, context) {
  for (const field of fields) {
    if (target[field] === undefined || target[field] === null) {
      target[field] = null
      continue
    }
    if (typeof target[field] === 'string') continue
    warn(context.logger, 'repair-persisted-string-field', 'Persisted string field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
    target[field] = null
  }
}

function coerceStringEnumField(target, field, allowedValues, fallback, context) {
  const value = target[field]
  if (typeof value === 'string' && allowedValues.includes(value)) return

  if (value !== undefined && value !== null) {
    warn(context.logger, 'repair-persisted-enum-field', 'Persisted enum field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
  }
  target[field] = fallback
}

function coerceNestedObjectField(target, parentField, childField, context) {
  const parent = target[parentField]
  if (!isPlainObject(parent)) return
  if (parent[childField] === undefined || parent[childField] === null) {
    parent[childField] = {}
    return
  }
  if (isPlainObject(parent[childField])) return
  warn(context.logger, 'repair-persisted-nested-object-field', 'Persisted nested object field had the wrong shape.', {
    field: `${parentField}.${childField}`,
    guildId: context.guildId,
    recordType: context.recordType
  })
  parent[childField] = {}
}

function coerceNestedCountFields(target, parentField, fields, context) {
  const parent = target[parentField]
  if (!isPlainObject(parent)) return
  coerceCountFields(parent, fields, {
    ...context,
    recordType: `${context.recordType}.${parentField}`
  })
}

function coerceNumberField(target, field, fallback, context) {
  const value = Number(target[field])
  if (Number.isFinite(value) && value > 0) {
    target[field] = value
    return
  }
  if (target[field] !== undefined && target[field] !== null) {
    warn(context.logger, 'repair-persisted-number-field', 'Persisted number field had the wrong shape.', {
      field,
      guildId: context.guildId,
      recordType: context.recordType
    })
  }
  target[field] = fallback
}

function coerceCountFields(target, fields, context) {
  for (const field of fields) {
    const value = Number(target[field])
    if (Number.isFinite(value) && value >= 0) {
      target[field] = value
      continue
    }
    if (target[field] !== undefined && target[field] !== null) {
      warn(context.logger, 'repair-persisted-count-field', 'Persisted count field had the wrong shape.', {
        field,
        guildId: context.guildId,
        recordType: context.recordType
      })
    }
    target[field] = 0
  }
}

function normalizeRoleCounts(target, { guildId, logger }) {
  let repaired = false
  const roleCounts = {}
  for (const [roleId, count] of Object.entries(target.roleCounts || {})) {
    const normalizedRoleId = String(roleId || '').trim()
    const normalizedCount = Number(count)
    if (!normalizedRoleId || !Number.isFinite(normalizedCount) || normalizedCount < 0) {
      repaired = true
      continue
    }
    roleCounts[normalizedRoleId] = normalizedCount
  }
  if (repaired) {
    warn(logger, 'repair-achievement-role-counts', 'Achievement role counts had malformed entries.', { guildId })
  }
  target.roleCounts = roleCounts
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function warn(logger, action, message, context) {
  logger?.warn?.(action, message, context)
}

module.exports = {
  coerceArrayFields,
  coerceBooleanField,
  coerceCountFields,
  coerceNestedCountFields,
  coerceNestedObjectField,
  coerceNullableStringFields,
  coerceNullableObjectFields,
  coerceNumberField,
  coerceObjectFields,
  coerceStringEnumField,
  isPlainObject,
  normalizeRoleCounts,
  warn
}
