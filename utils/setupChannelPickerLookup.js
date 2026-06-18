const {
  ChannelType
} = require('discord.js')
const {
  AUTO_SETUP_CATEGORY_NAME
} = require('./botcChannelNames')
const {
  getCachedGuildChannels
} = require('./discord/cacheValues')

function createExistingSetupCategory(guild) {
  return findAutoSetupCategory(getCachedGuildChannels(guild)) || null
}

function findAutoSetupCategory(channels) {
  return channels.find(channel =>
    channel?.type === ChannelType.GuildCategory &&
    channel?.name === AUTO_SETUP_CATEGORY_NAME
  ) || null
}

module.exports = {
  createExistingSetupCategory
}
