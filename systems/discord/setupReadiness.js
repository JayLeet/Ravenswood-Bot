const {
  getMissingBotPermissions,
  formatMissingBotPermissions
} = require('./permissions')
const {
  getCleanupChannels
} = require('../../utils/channelCleanup')
const {
  createBotLogger
} = require('../../utils/logger')

const REQUIRED_SETUP_KEYS = [
  'gameChannelId',
  'gamePanelMessageId',
  'liveChannelId',
  'playerGrimoireChannelId',
  'playerGrimoirePanelMessageId',
  'spectatorChannelId',
  'storytellerChannelId'
]

function createSetupReadiness({ gameManager, serverConfigs, logger = undefined }) {
  const log = createBotLogger({ logger, subsystem: 'SetupReadiness' })

  function isSetupComplete(serverConfig) {
    return !!serverConfig && REQUIRED_SETUP_KEYS.every(key => serverConfig[key])
  }

  function createSetupRequiredMessage() {
    return 'Run `/setup` first so I know where game controls, game info, and post-game reveals belong.'
  }

  async function ensureConfiguredGuildReady(discordClient, guild, serverConfig) {
    const configuredResults = await getConfiguredChannelResultsForClient(discordClient, serverConfig)
    const missingChannels = getMissingConfiguredChannelIds(configuredResults)
    if (missingChannels.length) {
      return {
        ok: false,
        message: `saved setup channels were deleted: ${missingChannels.join(', ')}. Run /setup again.`
      }
    }

    const configuredChannels = configuredResults.map(result => result.channel)
    const missingPermissions = getMissingBotPermissions(
      guild,
      configuredChannels.filter(Boolean),
      getCleanupChannels(configuredChannels, serverConfig)
    )

    if (missingPermissions.length) {
      return {
        ok: false,
        message: `missing permissions: ${missingPermissions.join(', ')}`
      }
    }

    const rolesReady = await gameManager.ensureGameRoles(guild)
    if (!rolesReady.ok) {
      return {
        ok: false,
        message: rolesReady.message
      }
    }

    return { ok: true }
  }

  async function ensureConfiguredServerReady(interaction, serverConfig) {
    const configuredResults = await getConfiguredChannelResults(interaction, serverConfig)
    const missingChannels = getMissingConfiguredChannelIds(configuredResults)
    if (missingChannels.length) {
      return {
        ok: false,
        title: 'Setup needed',
        message: 'Some saved setup channels were deleted or are no longer available. Run `/setup` again so I can recreate and save the current channels.',
        suggestion: 'Run `/setup`, then try this again.'
      }
    }

    const configuredChannels = configuredResults.map(result => result.channel)
    const missingPermissions = getMissingBotPermissions(
      interaction.guild,
      configuredChannels.filter(Boolean),
      getCleanupChannels(configuredChannels, serverConfig)
    )

    if (missingPermissions.length) {
      return {
        ok: false,
        title: 'Permissions needed',
        message: formatMissingBotPermissions(missingPermissions),
        suggestion: 'Ask an admin to grant the listed permissions, then rerun `/setup` if needed.'
      }
    }

    const rolesReady = await gameManager.ensureGameRoles(interaction.guild)

    if (!rolesReady.ok) {
      return {
        ok: false,
        title: 'Role setup needed',
        message: rolesReady.message,
        suggestion: 'Move the bot role above the game roles, then rerun `/setup`.'
      }
    }

    return { ok: true }
  }

  async function getConfiguredChannels(interaction, serverConfig) {
    return (await getConfiguredChannelResults(interaction, serverConfig))
      .map(result => result.channel)
  }

  async function getConfiguredChannelResults(interaction, serverConfig) {
    return fetchConfiguredChannelResults({
      action: 'fetch-configured-interaction-channel',
      channelIds: getConfiguredChannelIds(serverConfig),
      contextFor: channelId => ({
        channelId,
        guildId: interaction.guild?.id
      }),
      fetch: channelId => interaction.client.channels.fetch(channelId)
    })
  }

  async function getConfiguredChannelsForClient(discordClient, serverConfig) {
    return (await getConfiguredChannelResultsForClient(discordClient, serverConfig))
      .map(result => result.channel)
  }

  async function getConfiguredChannelResultsForClient(discordClient, serverConfig) {
    return fetchConfiguredChannelResults({
      action: 'fetch-configured-client-channel',
      channelIds: getConfiguredChannelIds(serverConfig),
      contextFor: channelId => ({ channelId }),
      fetch: channelId => discordClient.channels.fetch(channelId)
    })
  }

  async function fetchConfiguredChannelResults({ action, channelIds, contextFor, fetch }) {
    return Promise.all(channelIds.map(async channelId => {
      try {
        const channel = await fetch(channelId)
        return { channel: channel || null, channelId, missing: !channel }
      } catch (err) {
        if (!isUnknownChannelError(err)) {
          log.recoverable(action, err, contextFor(channelId))
        }
        return { channel: null, channelId, missing: isUnknownChannelError(err) }
      }
    }))
  }

  function getMissingConfiguredChannelIds(results) {
    return results.filter(result => result.missing).map(result => result.channelId)
  }

  function isUnknownChannelError(err) {
    return Number(err?.code) === 10003 || /Unknown Channel/i.test(String(err?.message || ''))
  }

  function getConfiguredChannelIds(serverConfig) {
    return [
      serverConfig.gameChannelId,
      serverConfig.gameLogChannelId,
      serverConfig.liveChannelId,
      serverConfig.playerGrimoireChannelId,
      serverConfig.postGameChannelId,
      serverConfig.spectatorChannelId,
      serverConfig.storytellerChannelId
    ].filter(Boolean)
  }

  return {
    createSetupRequiredMessage,
    ensureConfiguredGuildReady,
    ensureConfiguredServerReady,
    getConfiguredChannels,
    getConfiguredChannelsForClient,
    isSetupComplete
  }
}

module.exports = {
  REQUIRED_SETUP_KEYS,
  createSetupReadiness
}
