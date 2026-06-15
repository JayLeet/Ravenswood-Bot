function createPayloadSignature(payload) {
  return JSON.stringify(normalizePayload(payload))
}

function normalizePayload(payload = {}) {
  return {
    content: payload.content ?? null,
    embeds: normalizeItems(payload.embeds),
    components: normalizeItems(payload.components),
    allowedMentions: payload.allowedMentions ?? payload.allowed_mentions ?? null
  }
}

function normalizeItems(items) {
  return (items || []).map(item => normalizeItem(item))
}

function normalizeItem(item) {
  if (!item) return item
  if (typeof item.toJSON === 'function') return stripVolatilePayloadFields(item.toJSON())
  if (typeof item.data === 'object') return stripVolatilePayloadFields(item.data)
  return stripVolatilePayloadFields(item)
}

function stripVolatilePayloadFields(value) {
  if (Array.isArray(value)) return value.map(item => stripVolatilePayloadFields(item))
  if (!value || typeof value !== 'object') return value

  const normalized = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'timestamp') continue
    normalized[key] = stripVolatilePayloadFields(item)
  }
  return normalized
}

module.exports = {
  createPayloadSignature,
  normalizePayload,
  stripVolatilePayloadFields
}
