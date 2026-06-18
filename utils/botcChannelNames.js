const AUTO_SETUP_CATEGORY_NAME = 'Ravenswood Bluff'
const BOT_UPDATE_CHANNEL_NAME = '🤖-botc-bot-channel'
const BOT_UPDATE_CHANNEL_SOURCE = 'botc-bot-channel'

function normalizeChannelName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

module.exports = {
  AUTO_SETUP_CATEGORY_NAME,
  BOT_UPDATE_CHANNEL_NAME,
  BOT_UPDATE_CHANNEL_SOURCE,
  normalizeChannelName
}
