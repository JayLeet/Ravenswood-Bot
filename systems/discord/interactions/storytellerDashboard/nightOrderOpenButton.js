const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')

function isNightOrderOpenButton(input) {
  const value = getInteractionCustomId(input)
  if (getInteractionComponentLabel(input) === 'Night Order') return true
  return value === STORYTELLER_DASHBOARD_ACTIONS.nightOrder ||
    value === `${STORYTELLER_DASHBOARD_ACTIONS.nightOrder}:open` ||
    value === `${STORYTELLER_DASHBOARD_ACTIONS.action}:night-order`
}

function getInteractionCustomId(input) {
  if (typeof input === 'string') return input
  return String(input?.customId || '')
}

function getInteractionComponentLabel(input) {
  if (!input || typeof input === 'string') return ''
  return getComponentLabel(input.component) ||
    findClickedComponentLabel(input.message?.components, input.customId)
}

function getComponentLabel(component) {
  if (!component) return ''
  const data = component.toJSON?.() || component.data || component
  return String(data.label || component.label || '')
}

function findClickedComponentLabel(rows, customId) {
  for (const row of rows || []) {
    for (const component of row.components || []) {
      const data = component.toJSON?.() || component.data || component
      if (data?.custom_id === customId || data?.customId === customId) return String(data.label || '')
    }
  }
  return ''
}

module.exports = {
  isNightOrderOpenButton
}
