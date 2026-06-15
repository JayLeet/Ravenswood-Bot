const NIGHT_ACTION_PREFIX = 'botc:night-action:'

/** @type {import('../types').NightActionActions} */
const NIGHT_ACTION_ACTIONS = {
  ack: `${NIGHT_ACTION_PREFIX}ack`,
  clear: `${NIGHT_ACTION_PREFIX}clear`,
  copyGrimoire: `${NIGHT_ACTION_PREFIX}copy-grimoire`,
  dismissInfo: `${NIGHT_ACTION_PREFIX}dismiss-info`,
  page: `${NIGHT_ACTION_PREFIX}page`,
  player: `${NIGHT_ACTION_PREFIX}player`,
  respond: `${NIGHT_ACTION_PREFIX}respond`,
  role: `${NIGHT_ACTION_PREFIX}role`,
  submit: `${NIGHT_ACTION_PREFIX}submit`,
  target: `${NIGHT_ACTION_PREFIX}target`
}

function isNightActionInteraction(customId) {
  return typeof customId === 'string' && customId.startsWith(NIGHT_ACTION_PREFIX)
}

function createNightActionCustomId(action, actionId, value = null) {
  return [NIGHT_ACTION_ACTIONS[action], actionId, value]
    .filter(part => part !== null && part !== undefined && part !== '')
    .join(':')
}

function createNightInfoAckCustomId(playerId) {
  return createNightActionCustomId('ack', playerId)
}

function createNightInfoDismissCustomId(playerId, promptKey) {
  return createNightActionCustomId('dismissInfo', playerId, promptKey)
}

function createNightTargetCustomId(actionId) {
  return createNightActionCustomId('target', actionId)
}

function createNightResponseCustomId(actionId, optionKey) {
  return createNightActionCustomId('respond', actionId, optionKey)
}

function createNightResponsePageCustomId(actionId, page) {
  return createNightActionCustomId('page', actionId, page)
}

function createNightResponsePlayerCustomId(actionId, playerId) {
  return createNightActionCustomId('player', actionId, playerId)
}

function createNightResponseRoleCustomId(actionId, roleId) {
  return createNightActionCustomId('role', actionId, roleId)
}

function createNightSubmitCustomId(actionId) {
  return createNightActionCustomId('submit', actionId)
}

function createNightClearCustomId(actionId) {
  return createNightActionCustomId('clear', actionId)
}

function createNightCopyGrimoireCustomId(actionId) {
  return createNightActionCustomId('copyGrimoire', actionId)
}

function parseNightActionCustomId(customId) {
  const [prefix, scope, action, first, second, ...rest] = String(customId || '').split(':')
  const type = `${prefix}:${scope}:${action}`
  if (!Object.values(NIGHT_ACTION_ACTIONS).includes(type)) return null
  if (looksLikeScopedLegacyId(type, first, second)) return null

  const valueParts = [second, ...rest].filter(part => part !== undefined)
  return {
    type: action,
    guildId: null,
    actionId: first,
    value: valueParts.join(':') || null
  }
}

function looksLikeScopedLegacyId(type, first, second) {
  if (type === NIGHT_ACTION_ACTIONS.dismissInfo) return false
  return isDiscordSnowflake(first) && Boolean(second)
}

function isDiscordSnowflake(value) {
  return /^\d{15,20}$/.test(String(value || ''))
}

module.exports = {
  NIGHT_ACTION_ACTIONS,
  createNightClearCustomId,
  createNightCopyGrimoireCustomId,
  createNightInfoAckCustomId,
  createNightInfoDismissCustomId,
  createNightResponseCustomId,
  createNightResponsePageCustomId,
  createNightResponsePlayerCustomId,
  createNightResponseRoleCustomId,
  createNightSubmitCustomId,
  createNightTargetCustomId,
  isNightActionInteraction,
  parseNightActionCustomId
}
