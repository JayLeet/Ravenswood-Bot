const EMPTY_UPDATE_ACK = 'Action acknowledged.'

function hasVisibleInteractionContent(payload = {}) {
  if (hasNonEmptyString(payload.content)) return true
  if (hasNonEmptyArray(payload.embeds)) return true
  if (hasNonEmptyArray(payload.components)) return true
  if (hasNonEmptyArray(payload.files)) return true
  if (hasNonEmptyArray(payload.attachments)) return true
  if (hasNonEmptyArray(payload.stickers)) return true
  return false
}

function createSafeInteractionUpdatePayload(payload = {}) {
  if (hasVisibleInteractionContent(payload)) return payload
  return {
    ...payload,
    content: EMPTY_UPDATE_ACK
  }
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

module.exports = {
  EMPTY_UPDATE_ACK,
  createSafeInteractionUpdatePayload,
  hasVisibleInteractionContent
}
