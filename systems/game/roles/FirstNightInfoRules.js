const EVIL_INFO_BLOCKER_IDS = new Set(['poppy_grower', 'magician'])

function getFirstNightInfoPriority(role) {
  if (role?.team === 'demon') return 0
  if (role?.team === 'minion') return 1
  if (role?.team === 'townsfolk') return 2
  if (role?.team === 'outsider') return 3
  return 4
}

function isReceivedInfoConfirmation(nightAction) {
  return nightAction?.target === 'self' &&
    nightAction.receiptKind === 'received_info'
}

function shouldCreateFirstNightInfoCandidate(script, role, canFoldReceiptHook) {
  if (!role) return false
  if (isEvilTeamRole(role)) return !scriptBlocksAutomaticEvilInfo(script)
  return canFoldReceiptHook === true
}

function scriptBlocksAutomaticEvilInfo(script) {
  return scriptHasRole(script, EVIL_INFO_BLOCKER_IDS)
}

function shouldUseAlejoOrdering(viewOrGame, script) {
  if (!scriptHasSnakeCharmer(script)) return false
  return viewOrGame?.engine?.nightOptions?.alejoRules !== false &&
    viewOrGame?.nightOptions?.alejoRules !== false
}

function shouldSuppressAutomaticEvilInfoForView(view) {
  const script = getViewScript(view)
  if (scriptBlocksAutomaticEvilInfo(script)) return true
  if (!scriptHasSnakeCharmer(script)) return false
  return view?.engine?.nightOptions?.alejoRules !== false
}

function scriptHasSnakeCharmer(script) {
  return scriptHasRole(script, new Set(['snake_charmer']))
}

function isEvilTeamRole(role) {
  return role?.team === 'demon' || role?.team === 'minion'
}

function scriptHasRole(script, ids) {
  return (script?.roles || []).some(role => ids.has(normalizeRoleId(role?.id || role?.name)))
}

function normalizeRoleId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getViewScript(view) {
  if (view?.script?.roles) return view.script
  if (!view?.scriptId) return null
  return require('../../../scripts').getScript(view.scriptId)
}

module.exports = {
  getFirstNightInfoPriority,
  isReceivedInfoConfirmation,
  scriptBlocksAutomaticEvilInfo,
  scriptHasSnakeCharmer,
  shouldCreateFirstNightInfoCandidate,
  shouldSuppressAutomaticEvilInfoForView,
  shouldUseAlejoOrdering
}
