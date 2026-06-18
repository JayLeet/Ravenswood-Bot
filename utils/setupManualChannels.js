const {
  ensureSetupTextChannels,
  ensureSetupVoiceChannels,
  refreshGameLogChannel
} = require('./setupAutoChannels')
const {
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')

async function getManualSetupChannels(interaction, gameManager = null, selection = null, options = {}) {
  const managedChannels = { ...(options.manualManagedChannels || {}) }
  const managedCategories = {}
  const manualSelection = selection || {}
  const category = manualSelection.category || null
  const gameLogChannel = manualSelection.gameLogChannel || null
  const gameLogSaveMode = normalizeGameLogSaveMode(manualSelection.gameLogSaveMode, null)
  const waitingRoomVoiceChannel = manualSelection.waitingRoomVoiceChannel || null

  if (!category) {
    return {
      ok: false,
      message: 'Choose a setup category before continuing manual setup.'
    }
  }
  if (!waitingRoomVoiceChannel || !gameLogChannel) {
    return {
      ok: false,
      message: 'Choose both the Waiting Room voice channel and game-log archive channel before continuing manual setup.'
    }
  }
  if (!gameLogSaveMode) {
    return {
      ok: false,
      message: 'Choose whether game logs should save automatically or wait for Storyteller approval.'
    }
  }

  const managedOptions = {
    managedChannels,
    managedCategories,
    onManagedCategory: options.onManagedCategory,
    onManagedChannel: options.onManagedChannel
  }
  const textChannels = await ensureSetupTextChannels(interaction.guild, category, gameManager, managedOptions)
  if (!textChannels.ok) return textChannels
  const refreshedGameLogChannel = await refreshGameLogChannel(interaction.guild, gameLogChannel, gameManager)
  if (!refreshedGameLogChannel) return { ok: false, message: 'I could not refresh the game-log archive channel permissions.' }

  const sharedVoice = await ensureSetupVoiceChannels(interaction.guild, category, gameManager, {
    ...managedOptions,
    waitingRoomVoiceChannel
  })
  if (!sharedVoice.ok) return sharedVoice

  return {
    ok: true,
    channels: { ...textChannels.channels, gameLogChannel: refreshedGameLogChannel },
    gameLogSaveMode,
    managedCategories,
    managedChannels,
    sharedVoiceChannels: sharedVoice.channels,
    autoCreated: false
  }
}

module.exports = {
  getManualSetupChannels
}
