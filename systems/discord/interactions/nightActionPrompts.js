const {
  createNightResponseMenuPayload,
  createNightTargetPromptPayload,
  parseNightActionCustomId
} = require('../embeds')
const {
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  sendOrEditNightPromptMessage
} = require('./nightPromptMessages')
const {
  acknowledgeInteraction,
  respondPrivateSystem
} = require('./feedback')
const {
  pruneMissingNightChannels,
  shouldRecoverNightActionPrompt
} = require('./nightActionPrompts/recoveryState')
const { createNightActionAreaHelpers } = require('./nightActionPrompts/nightAreaChannels')
const { handleNightInfoPromptDismiss } = require('./nightActionPrompts/dismissInfoPrompt')
const { disableStaleNightActionPrompts } = require('./nightActionPrompts/stalePrompts')
const { getNightActionMember } = require('./nightActionPrompts/memberLookup')
const { refreshSubstituteNightArea } = require('./nightActionPrompts/substituteNightAreaRefresh')
const { createStorytellerNightInfoNoticeHandlers } = require('./nightActionPrompts/storytellerNotice')
const { updateNightCottageStatus } = require('./nightCottageStatus')
const { formatRoleWithEmoji } = require('../../../utils/roleFormatting')
const {
  resolveTestPlayerInteractionMember
} = require('./testPlayerSimulation')
const {
  handleNightActionSubmission,
  validateNightActionContext
} = require('./nightActionPromptSubmissions')
const { clearGuildNightActionDrafts } = require('./nightActionDrafts')
const { createBotLogger } = require('../../../utils/logger')

function createNightActionPromptSystem({
  client,
  serverConfigs,
  gameLifecycle,
  isSetupComplete,
  getDashboardPlayerLabels,
  postOrUpdateStorytellerDashboard
}) {
  const log = createBotLogger({ subsystem: 'NightActionPrompts' })
  let registered = false
  const storytellerNotices = createStorytellerNightInfoNoticeHandlers({
    gameLifecycle,
    getDashboardPlayerLabels,
    isSetupComplete,
    serverConfigs
  })
  const nightAreaHelpers = createNightActionAreaHelpers({
    gameLifecycle,
    logger: log
  })

  function registerNightActionPromptDispatch() {
    if (registered) return false
    registered = true

    gameLifecycle.events.on('NIGHT_ACTION_CREATED', async ({ game, action }) => {
      if (!action?.autoPrompt || !game?.guildId) return
      await dispatchAutomaticNightActionPrompt(client, game.guildId, action).catch(err => {
        log.recoverable('dispatch-automatic-night-action-prompt', err, {
          actionId: action.id,
          guildId: game.guildId,
          playerId: action.actorId || action.playerId
        })
      })
    })
    gameLifecycle.events.on('PLAYER_SUBSTITUTED', async ({ game, member }) => {
      if (!game?.guildId || !member) return
      await refreshSubstituteNightAreaForSystem(client, game.guildId, member).catch(err => {
        log.recoverable('refresh-substitute-night-area', err, {
          guildId: game.guildId,
          userId: member.id
        })
      })
    })
    gameLifecycle.events.on('GAME_ENDED', ({ game }) => {
      if (!game?.guildId) return
      clearGuildNightActionDrafts(game.guildId)
    })

    return true
  }

  function refreshSubstituteNightAreaForSystem(discordClient, guildId, member) {
    return refreshSubstituteNightArea({
      discordClient,
      ensurePlayerNightAreaForGuild: nightAreaHelpers.ensurePlayerNightAreaForGuild,
      gameLifecycle,
      guildId,
      isSetupComplete,
      member,
      serverConfigs
    })
  }

  async function dispatchAutomaticNightActionPrompt(discordClient, guildId, action) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null
    const game = gameLifecycle.get(guildId)
    if (!game) return null
    const view = gameLifecycle.getGameView(guildId)
    if (!view) return null
    const actorId = action.actorId || action.playerId
    const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(err => {
      log.recoverable('fetch-guild-for-night-action-prompt', err, {
        actionId: action.id,
        guildId,
        playerId: actorId
      })
      return null
    })
    if (!guild) return null

    const member = await getNightActionMember({ gameLifecycle, game, guild, logger: log, playerId: actorId, view })
    if (!member) return null
    const channel = await nightAreaHelpers.ensurePlayerNightChannelForGuild(discordClient, guild, serverConfig, game, view, member)
    if (!channel) return null

    const message = await postOrUpdateNightActionPrompt(discordClient, guildId, game, view, action, channel)
    await postOrUpdateStorytellerDashboard(discordClient, guildId)
    return message
  }

  async function recoverNightActionPrompts(discordClient, guild, serverConfig, game, view) {
    let recovered = await disableStaleNightActionPrompts(discordClient, game, log, gameLifecycle)
    if (game.phase !== 'night') return recovered
    await pruneMissingNightChannels({ game, gameLifecycle, guild, logger: log })

    for (const action of game.nightActions || []) {
      if (action.status !== 'awaiting_target') continue
      if (action.day !== game.day || action.phase !== game.phase) continue

      const actorId = action.actorId || action.playerId
      if (!actorId || gameLifecycle.getRole(game, actorId) !== 'player') continue
      if (!shouldRecoverNightActionPrompt(game, action, actorId)) continue

      const member = await getNightActionMember({ gameLifecycle, game, guild, logger: log, playerId: actorId, view })
      if (!member) continue
      const channel = await nightAreaHelpers.ensurePlayerNightChannelForGuild(discordClient, guild, serverConfig, game, view, member)
      if (!channel) continue

      const message = await postOrUpdateNightActionPrompt(discordClient, guild.id, game, view, action, channel)
      if (message) recovered += 1
    }

    return recovered
  }

  async function postOrUpdateNightActionPrompt(discordClient, guildId, game, view, action, fallbackChannel) {
    const actorId = action.actorId || action.playerId
    const playerLabels = await getDashboardPlayerLabels(discordClient, guildId, view)
    const payload = ['self', 'text'].includes(action.targetType)
      ? createNightResponseMenuPayload({ action, playerLabels, text: action.prompt, view })
      : createNightTargetPromptPayload({ action, actorId, players: view.users.players, playerLabels, view })
    const delivered = await sendOrEditNightPromptMessage({
      action,
      channel: fallbackChannel,
      client: discordClient,
      game,
      gameLifecycle,
      guildId,
      logger: log,
      payload,
      playerId: actorId
    })
    return delivered?.message || null
  }

  async function handleNightActionInteraction(interaction) {
    await acknowledgeInteraction(interaction)
    const parsed = parseNightActionCustomId(interaction.customId)

    if (!parsed || (parsed.guildId && parsed.guildId !== interaction.guild?.id)) {
      return sendNightCottageFailure(interaction, interaction.member.id, 'That night action is not valid for this server.', 'Ask the Storyteller to wake you again from the dashboard.')
    }

    if (parsed.type === 'ack') return storytellerNotices.handleNightInfoAcknowledgement(interaction, parsed)
    if (parsed.type === 'dismiss-info') {
      return handleNightInfoPromptDismiss({
        gameLifecycle,
        interaction,
        logger: log,
        parsed,
        sendFailure: sendNightCottageFailure
      })
    }
    if (parsed.type === 'page') return handleNightResponsePage(interaction, parsed)

    return handleNightActionSubmission(interaction, parsed, {
      gameLifecycle,
      getPlayerLabel,
      getPlayerLabels: getDashboardPlayerLabels,
      getRoleLabel,
      postOrUpdateStorytellerDashboard,
      sendFailure: sendNightCottageFailure,
      sendStatus: sendNightCottageStatus,
      sendStorytellerNotice: storytellerNotices.sendStorytellerChannelNotice
    })
  }

  async function handleNightResponsePage(interaction, parsed) {
    const context = await getNightResponseContext(interaction, parsed)
    const validation = validateNightActionContext(context, gameLifecycle)
    if (!validation.ok) return sendNightCottageFailure(interaction, context.userId, validation.message)

    const payload = createNightResponseMenuPayload({
      action: context.action,
      page: parsed.value || 'main',
      playerLabels: context.playerLabels,
      text: context.action.prompt,
      view: context.view
    })
    if (interaction.message) await queuedMessageEdit(interaction.message, payload).catch(err => {
      log.recoverable('update-night-response-page', err, { actionId: context.action?.id, guildId: interaction.guild?.id, messageId: interaction.message?.id, page: parsed.value || 'main', userId: interaction.member?.id })
      return null
    })
    return sendNightCottageStatus(interaction, context.action.actorId || context.action.playerId || context.userId, 'Done', 'Menu updated.', 0x2ecc71)
  }

  async function getNightResponseContext(interaction, parsed) {
    const game = gameLifecycle.get(interaction.guild.id)
    const view = gameLifecycle.getGameView(interaction.guild.id)
    const action = game?.nightActions?.find(item => item.id === parsed.actionId) || null
    const actorId = action?.actorId || action?.playerId || interaction.member.id
    const member = resolveTestPlayerInteractionMember({
      game,
      gameLifecycle,
      interaction,
      playerId: actorId,
      view
    })
    const playerLabels = view ? await getDashboardPlayerLabels(interaction.client, interaction.guild.id, view) : {}
    return { action, game, member, playerLabels, userId: member?.id || interaction.member.id, view }
  }

  async function getPlayerLabel(interaction, playerId) {
    const view = gameLifecycle.getGameView(interaction.guild.id)
    const labels = view ? await getDashboardPlayerLabels(interaction.client, interaction.guild.id, view) : {}
    return labels[playerId] || `<@${playerId}>`
  }

  async function getRoleLabel(interaction, roleId) {
    const view = gameLifecycle.getGameView(interaction.guild.id)
    return formatRoleWithEmoji(view, roleId)
  }

  async function sendNightCottageFailure(interaction, playerId, message, suggestion = null) {
    return respondPrivateSystem(interaction, 'Action failed', message, suggestion)
  }

  async function sendNightCottageStatus(interaction, playerId, title, description, color) {
    const game = gameLifecycle.get(interaction.guild.id)
    return updateNightCottageStatus({
      channel: interaction.channel,
      client: interaction.client,
      color,
      description,
      game,
      gameLifecycle,
      playerId,
      title
    })
  }

  return {
    dispatchAutomaticNightActionPrompt,
    ensurePlayerNightChannel: nightAreaHelpers.ensurePlayerNightChannel,
    ensurePlayerNightVoiceChannel: nightAreaHelpers.ensurePlayerNightVoiceChannel,
    findNightChannelParent: nightAreaHelpers.findNightChannelParent,
    handleNightActionInteraction,
    recoverNightActionPrompts,
    refreshSubstituteNightArea: refreshSubstituteNightAreaForSystem,
    registerNightActionPromptDispatch
  }
}

module.exports = {
  createNightActionPromptSystem
}
