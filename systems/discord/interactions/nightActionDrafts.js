const drafts = new Map()
const NIGHT_ACTION_DRAFT_TTL_MS = 30 * 60 * 1000

function getNightActionDraft(guildId, actionId, userId) {
  return getDraftEntry(guildId, actionId, userId).items
}

function addNightActionDraftItem(guildId, actionId, userId, item) {
  const entry = getDraftEntry(guildId, actionId, userId)
  const createdAt = Date.now()
  entry.updatedAt = createdAt
  entry.items.push({
    ...item,
    createdAt
  })
  return entry.items
}

function clearNightActionDraft(guildId, actionId, userId) {
  drafts.delete(createDraftKey(guildId, actionId, userId))
  return []
}

function clearGuildNightActionDrafts(guildId) {
  const prefix = `${String(guildId || '')}:`
  let removed = 0
  for (const key of drafts.keys()) {
    if (!key.startsWith(prefix)) continue
    drafts.delete(key)
    removed += 1
  }
  return removed
}

function consumeNightActionDraft(guildId, actionId, userId) {
  const items = getNightActionDraft(guildId, actionId, userId)
  clearNightActionDraft(guildId, actionId, userId)
  return items
}

function formatNightActionDraft(items = []) {
  return items
    .map((item, index) => `${index + 1}. ${item.label || item.text || 'Selected response'}`)
    .join('\n')
}

function createDraftKey(guildId, actionId, userId) {
  return [guildId, actionId, userId].map(value => String(value || '')).join(':')
}

function getDraftEntry(guildId, actionId, userId) {
  const key = createDraftKey(guildId, actionId, userId)
  if (!drafts.has(key)) drafts.set(key, { items: [], updatedAt: Date.now() })
  return drafts.get(key)
}

function pruneNightActionDrafts(now = Date.now()) {
  let removed = 0
  for (const [key, entry] of drafts.entries()) {
    if (now - (Number(entry.updatedAt) || 0) < NIGHT_ACTION_DRAFT_TTL_MS) continue
    drafts.delete(key)
    removed += 1
  }
  return removed
}

function nightActionDraftSize() {
  return drafts.size
}

function resetNightActionDrafts() {
  drafts.clear()
}

module.exports = {
  NIGHT_ACTION_DRAFT_TTL_MS,
  addNightActionDraftItem,
  clearGuildNightActionDrafts,
  clearNightActionDraft,
  consumeNightActionDraft,
  formatNightActionDraft,
  getNightActionDraft,
  nightActionDraftSize,
  pruneNightActionDrafts,
  resetNightActionDrafts
}
