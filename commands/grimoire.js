const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  fetchWithRecoverableFallback
} = require('../utils/discord/recoverableFetch')
const {
  createCurrentGrimoirePayload,
  createGrimoirePlayerLabels,
  createGrimoireRequestNotice,
  createGrimoireRequestSubmittedMessage
} = require('../utils/grimoireAccess')
const {
  createPlayerGrimoirePayload
} = require('../utils/playerGrimoire')
const {
  createBotLogger
} = require('../utils/logger')

const SETUP_CHANNEL_ID_KEYS = Object.freeze([
  'gameChannelId',
  'gameLogChannelId',
  'liveChannelId',
  'playerGrimoireChannelId',
  'postGameChannelId',
  'spectatorChannelId',
  'storytellerChannelId'
])
const log = createBotLogger({ subsystem: 'GrimoireCommand' })

module.exports = {
  name: 'grimoire',
  description: 'Open your private player grimoire, or request spectator grimoire access.',
  options: [],
  data: {
    name: 'grimoire',
    description: 'Open your private player grimoire, or request spectator grimoire access.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle, gameManager, serverConfig }) => {
    const view = gameLifecycle.getGameView(interaction.guild.id)
    if (!view) {
      return {
        ok: false,
        error: { message: 'No active game found.' }
      }
    }

    if ((view.users.players || []).includes(interaction.member.id)) {
      return createPrivatePlayerGrimoireResult(gameLifecycle, interaction, view)
    }

    const isSpectator = (view.users.spectators || []).includes(interaction.member.id)
    const hasAccess = gameManager.hasGrimoireSpectatorRole(interaction.member)

    if (isSpectator && hasAccess) {
      if (interaction.channelId !== serverConfig.spectatorChannelId) {
        return createWrongGrimoireChannelResult(serverConfig)
      }
      return createPrivateGrimoireResult(view)
    }

    if (!isSpectator) {
      return {
        ok: false,
        error: { message: 'Only spectators can request grimoire access.' }
      }
    }

    if (!await isGrimoireRequestChannel(interaction, serverConfig)) {
      return createWrongGrimoireRequestChannelResult()
    }

    const result = await gameLifecycle.requestGrimoireAccess(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result
    if (result.alreadyGranted) return createPrivateGrimoireResult(view)

    return {
      ok: true,
      message: createGrimoireRequestSubmittedMessage(),
      storytellerMessage: createGrimoireRequestNotice(
        interaction.member.id,
        result.request.id
      )
    }
  }),
  createWrongGrimoireChannelResult,
  createWrongGrimoireRequestChannelResult,
  getConfiguredSetupCategoryIds,
  getConfiguredSetupChannelIds,
  isGrimoireRequestChannel
}

function createPrivateGrimoireResult(view) {
  return {
    ok: true,
    ...createCurrentGrimoirePayload(view, createGrimoirePlayerLabels(view))
  }
}

function createPrivatePlayerGrimoireResult(gameLifecycle, interaction, view) {
  return {
    ok: true,
    ...createPlayerGrimoirePayload({
      view,
      ownerId: interaction.member.id,
      notes: gameLifecycle.getPlayerGrimoireNotes(interaction.guild.id, interaction.member.id),
      playerLabels: createGrimoirePlayerLabels(view)
    })
  }
}

function createWrongGrimoireChannelResult(serverConfig) {
  return {
    ok: false,
    error: { message: `Use /grimoire in <#${serverConfig.spectatorChannelId}>.` }
  }
}

function createWrongGrimoireRequestChannelResult() {
  return {
    ok: false,
    error: {
      message: 'Use /grimoire in a normal server channel outside the BOTC setup category to request access.'
    }
  }
}

async function isGrimoireRequestChannel(interaction, serverConfig = {}) {
  if (!interaction?.channelId) return false
  if (getConfiguredSetupChannelIds(serverConfig).includes(interaction.channelId)) return false

  const channel = interaction.channel || await fetchWithRecoverableFallback({
    action: 'fetch-grimoire-request-channel',
    context: {
      channelId: interaction.channelId,
      guildId: interaction.guild?.id
    },
    fetch: () => interaction.client.channels.fetch(interaction.channelId),
    logger: log
  })
  if (!channel) return false

  const setupCategoryIds = await getConfiguredSetupCategoryIds(interaction.client, serverConfig, log)
  return !channel.parentId || !setupCategoryIds.includes(channel.parentId)
}

function getConfiguredSetupChannelIds(serverConfig = {}) {
  return [...new Set(SETUP_CHANNEL_ID_KEYS
    .map(key => serverConfig[key])
    .filter(Boolean))]
}

async function getConfiguredSetupCategoryIds(client, serverConfig = {}, logger = log) {
  const categoryIds = new Set()

  for (const channelId of getConfiguredSetupChannelIds(serverConfig)) {
    const channel = await fetchWithRecoverableFallback({
      action: 'fetch-configured-grimoire-setup-channel',
      context: { channelId },
      fetch: () => client.channels.fetch(channelId),
      logger
    })
    if (channel?.parentId) categoryIds.add(channel.parentId)
  }

  return [...categoryIds]
}
