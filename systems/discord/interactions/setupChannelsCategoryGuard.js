const {
  SETUP_CHANNEL_PICKER_KEYS
} = require('../../../utils/setupChannelPicker')

function getSelectionCategoryNotice(channels) {
  const selected = SETUP_CHANNEL_PICKER_KEYS.map(key => channels[key]).filter(Boolean)
  if (!selected.length) return null

  const parentIds = selected.map(channel => channel.parentId || channel.parent?.id || null)
  if (parentIds.some(parentId => !parentId)) {
    return {
      title: 'Category needed',
      message: 'Selected setup channels must be inside one category. Move that channel into a category, or clear it and use `Create missing channels`.'
    }
  }

  if (new Set(parentIds.map(String)).size > 1) {
    return {
      title: 'One category needed',
      message: 'Selected setup channels must all be inside the same category before setup can continue.'
    }
  }

  return null
}

module.exports = {
  getSelectionCategoryNotice
}
