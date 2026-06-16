const {
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  ensureGameLogChannel,
  ensurePlayerGrimoireChannel,
  ensurePostGameChannel,
  ensureSetupVoiceChannels
} = require('./setupAutoChannels')

const SETUP_CHANNEL_OPTION_NAMES = Object.freeze({
  gameChannel: 'game-channel',
  liveChannel: 'live-channel',
  spectatorChannel: 'spectator-channel',
  storytellerChannel: 'storyteller-channel'
})

async function getManualSetupChannels(interaction, gameManager = null, selection = null, options = {}) {
  const managedChannels = { ...(options.manualManagedChannels || {}) }
  const managedCategories = {}
  const channels = selection || {
    gameChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.gameChannel),
    liveChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.liveChannel),
    spectatorChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.spectatorChannel),
    storytellerChannel: interaction.options?.getChannel?.(SETUP_CHANNEL_OPTION_NAMES.storytellerChannel)
  }

  if (Object.values(channels).some(channel => !channel)) {
    return {
      ok: false,
      message: 'Choose all four setup channels in the setup-channel picker, or use `/setup` to create the Ravenswood Bluff setup automatically.'
    }
  }

  const category = getManualSetupCategory(interaction.guild, channels)
  if (!category || !manualChannelsShareCategory(channels, category.id)) {
    return {
      ok: false,
      message: 'Choose setup channels inside one category before continuing setup.'
    }
  }
  const managedOptions = {
    managedChannels,
    managedCategories,
    onManagedCategory: options.onManagedCategory,
    onManagedChannel: options.onManagedChannel
  }
  const postGameChannel = await ensurePostGameChannel(interaction.guild, category, gameManager, managedOptions)
  if (!postGameChannel) return { ok: false, message: 'I could not create the post-game reveal channel.' }

  const gameLogChannel = await ensureGameLogChannel(interaction.guild, category, gameManager, managedOptions)
  if (!gameLogChannel) return { ok: false, message: 'I could not create the game-log archive channel.' }

  const playerGrimoireChannel = await ensurePlayerGrimoireChannel(interaction.guild, category, gameManager, managedOptions)
  if (!playerGrimoireChannel) return { ok: false, message: 'I could not create the player grimoire channel.' }

  const sharedVoice = await ensureSetupVoiceChannels(interaction.guild, category, gameManager, managedOptions)
  if (!sharedVoice.ok) return sharedVoice

  return {
    ok: true,
    channels: { ...channels, gameLogChannel, playerGrimoireChannel, postGameChannel },
    managedCategories,
    managedChannels,
    sharedVoiceChannels: sharedVoice.channels,
    autoCreated: false
  }
}

function getManualSetupCategory(guild, channels) {
  const channel = Object.values(channels).find(item => item?.parent || item?.parentId)
  if (!channel) return null
  return channel.parent || guild?.channels?.cache?.get?.(channel.parentId) || null
}

function manualChannelsShareCategory(channels, categoryId) {
  return Object.values(channels).every(channel =>
    String(channel?.parentId || channel?.parent?.id || '') === String(categoryId)
  )
}

module.exports = {
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  SETUP_CHANNEL_OPTION_NAMES,
  getManualSetupChannels
}
