const {
  getMissingBotPermissions,
  formatMissingBotPermissions
} = require('../permissions')
const {
  isGamePanelAction,
  isGamePanelInteraction,
  isStorytellerDashboardAction,
  isNightActionInteraction,
  isVotingInteraction
} = require('../embeds')
const { isNominationRequestInteraction } = require('../../../utils/nominationRequests')
const { isPlayerGrimoireInteraction } = require('../../../utils/playerGrimoire')
const { isPrivateVoiceRequestInteraction } = require('../../../utils/privateVoiceRequests')
const { isRequestDecisionInteraction } = require('../../../utils/requestDecisionButtons')
const { isBotUpdateNotificationInteraction } = require('../../../utils/botUpdateNotifications')
const { isSetupAccessChoiceInteraction } = require('../../../utils/setupAccessChoice')
const { isSetupChannelsInteraction } = require('../../../utils/setupChannelPicker')
const { isSetupDeleteInteraction } = require('../../../utils/setupDelete')
const { isSetupUnsafeRoleInteraction } = require('../../../utils/setupUnsafeRoles')
const { isStorytellerRequestInteraction } = require('../../../utils/storytellerRequestButtons')
const { isFirstJoinSetupNoticeInteraction } = require('../firstJoinSetupNotice')
const { isIdleLobbyInteraction } = require('./idleLobbyWatch')
const { isGameLogDecisionInteraction } = require('./gameLog')
const { isSetupSettingsInteraction } = require('./setupSettingsPanel')
const {
  cleanupPostGameChannelMessages,
  cleanupSetupChannels,
  getCleanupChannels
} = require('../../../utils/channelCleanup')
const { registerRuntimeMaintenanceTask } = require('../../../utils/runtimeMaintenance')
const {
  createAdminInteractionDiagnostics
} = require('./adminDiagnostics')
const { createButtonRateLimiter } = require('./buttonRateLimit')
const {
  guardPausedReplacementCommand,
  guardPausedReplacementInteraction
} = require('./pausedGuard')
const {
  replyPrivateSystem,
  respondAutocomplete,
  respondPrivateSystem
} = require('./feedback')
const {
  isIgnorableInteractionResponseError
} = require('../../../utils/discord/interactionErrors')
const {
  createBotLogger
} = require('../../../utils/logger')

function createInteractionRouter(deps) {
  const {
    client, gameLifecycle, gameManager, serverConfigs, saveServerConfigs,
    isSetupComplete, createSetupRequiredMessage, getConfiguredChannels,
    handleBotUpdateNotificationInteraction, handleGamePanelInteraction,
    handleFirstJoinSetupNoticeInteraction, handleGameLogInteraction, handleIdleLobbyInteraction, handleNightActionInteraction,
    handleNominationRequestInteraction, handlePlayerGrimoireInteraction,
    handlePrivateVoiceRequestInteraction,
    handleRequestDecisionInteraction, handleSetupAccessChoiceInteraction,
    handleSetupChannelsInteraction, handleSetupDeleteInteraction, handleSetupSettingsInteraction, handleSetupUnsafeRoleInteraction,
    handleStorytellerRequestInteraction, handleStorytellerDashboardInteraction,
    handleVotingInteraction, postOrUpdateStorytellerDashboard
  } = deps
  const log = createBotLogger({ subsystem: 'InteractionRouter' })
  const adminDiagnostics = createAdminInteractionDiagnostics({ serverConfigs })
  const buttonRateLimiter = createButtonRateLimiter({ gameLifecycle })
  registerRuntimeMaintenanceTask('buttonRateLimiter', () => ({ removed: buttonRateLimiter.prune(), size: buttonRateLimiter.size() }))

  async function handleInteraction(interaction) {
    const diagnostics = adminDiagnostics.watch(interaction)
    try {
      if (interaction.isAutocomplete()) return await handleAutocomplete(interaction)
      const limited = await buttonRateLimiter.guard(interaction)
      if (limited) return limited
      if (interaction.isButton() && isHelpButton(interaction)) return await client.commands.get('help')?.handleHelpInteraction?.(interaction)

      const pauseBlock = guardPausedReplacementInteraction(interaction, gameLifecycle)
      if (pauseBlock) return await pauseBlock

      const componentResult = await tryComponentHandlers(interaction, {
        handleBotUpdateNotificationInteraction, handleGameLogInteraction,
        handleFirstJoinSetupNoticeInteraction, handleGamePanelInteraction, handleIdleLobbyInteraction, handleNightActionInteraction,
        handleNominationRequestInteraction, handlePlayerGrimoireInteraction,
        handlePrivateVoiceRequestInteraction,
        handleRequestDecisionInteraction, handleSetupAccessChoiceInteraction,
        handleSetupChannelsInteraction, handleSetupDeleteInteraction, handleSetupSettingsInteraction, handleSetupUnsafeRoleInteraction,
        handleStorytellerRequestInteraction, handleStorytellerDashboardInteraction,
        handleVotingInteraction
      })
      if (componentResult.matched && componentResult.result) return await componentResult.result
      if (componentResult.matched && hasInteractionResponse(interaction)) return null
      if (isUnhandledComponent(interaction)) return await handleUnhandledComponent(interaction)
      if (!interaction.isChatInputCommand()) return

      const cmd = client.commands.get(interaction.commandName)
      if (!cmd) return await handleUnknownCommand(interaction)
      const pausedBlock = guardPausedReplacementCommand(interaction, gameLifecycle)
      if (pausedBlock) return await pausedBlock

      const serverConfig = serverConfigs.get(interaction.guild.id)
      const setupComplete = isSetupComplete(serverConfig)
      const setupBlock = await guardCommandSetup(interaction, cmd, {
        createSetupRequiredMessage, getConfiguredChannels, gameManager, isSetupComplete,
        serverConfig, setupComplete
      })
      if (setupBlock) return await setupBlock

      await cmd.execute(interaction, {
        client,
        gameLifecycle, gameManager,
        serverConfig: setupComplete ? serverConfig : null,
        serverConfigs, saveServerConfigs,
        cleanupSetupChannels: setupComplete ? () => cleanupSetupChannels(interaction.client, serverConfig) : null,
        cleanupPostGameChannelMessages: setupComplete ? () => cleanupPostGameChannelMessages(interaction.client, serverConfig) : null,
        postOrUpdateStorytellerDashboard
      })
    } catch (err) {
      if (isIgnorableInteractionResponseError(err)) return null
      log.error('interaction-handler-crash', err, {
        command: interaction.commandName,
        customId: interaction.customId,
        guildId: interaction.guild?.id,
        type: interaction.type,
        userId: interaction.user?.id || interaction.member?.id
      })
      if (await diagnostics.reportFailure(err)) return null
      return handleInteractionCrash(interaction)
    } finally {
      diagnostics.finish()
    }
  }

  async function handleAutocomplete(interaction) {
    const cmd = client.commands.get(interaction.commandName)
    if (!cmd?.autocomplete) return respondAutocomplete(interaction)
    return cmd.autocomplete(interaction, {
      gameLifecycle, gameManager,
      serverConfig: serverConfigs.get(interaction.guild?.id) || null,
      serverConfigs, saveServerConfigs
    })
  }

  async function guardCommandSetup(interaction, cmd, ctx) {
    const { serverConfig, setupComplete } = ctx
    if (!setupComplete && !cmd.setupExempt) {
      return replyPrivateSystem(interaction, 'Setup required', ctx.createSetupRequiredMessage(), 'Ask an admin to run `/setup`, then use the game panel it posts.')
    }
    if (setupComplete && interaction.commandName !== 'setup') {
      const ready = await ensureCommandEnvironment(interaction, serverConfig, ctx)
      if (ready) return ready
    }
    if (cmd.storytellerChannelOnly && setupComplete && interaction.channelId !== serverConfig.storytellerChannelId) {
      return replyPrivateSystem(interaction, 'Wrong channel', `Use this command in <#${serverConfig.storytellerChannelId}>.`, 'Run it in the Storyteller channel, or use `/help` to see which commands belong where.')
    }
    if (cmd.storytellerChannelOnly && setupComplete) {
      const game = ctx.gameLifecycle.get(interaction.guild.id)
      if (game && !ctx.gameLifecycle.isStoryteller(game, interaction.member.id)) {
        return replyPrivateSystem(interaction, 'Storyteller only', 'Only the current Storyteller can use this command.', 'Use `/spectate` to watch, or `/join` if you want to play.')
      }
    }
    return null
  }

  return { handleInteraction }
}

async function tryComponentHandlers(interaction, handlers) {
  if (interaction.isButton() && isIdleLobbyInteraction(interaction.customId)) return runMatchedHandler(handlers.handleIdleLobbyInteraction, interaction)
  if ((interaction.isButton() || interaction.isChannelSelectMenu?.()) && isBotUpdateNotificationInteraction(interaction.customId)) return runMatchedHandler(handlers.handleBotUpdateNotificationInteraction, interaction)
  if (interaction.isButton() && isFirstJoinSetupNoticeInteraction(interaction.customId)) return runMatchedHandler(handlers.handleFirstJoinSetupNoticeInteraction, interaction)
  if (interaction.isButton() && isSetupDeleteInteraction(interaction.customId)) return runMatchedHandler(handlers.handleSetupDeleteInteraction, interaction)
  if (interaction.isButton() && isSetupAccessChoiceInteraction(interaction.customId)) return runMatchedHandler(handlers.handleSetupAccessChoiceInteraction, interaction)
  if ((interaction.isButton() || interaction.isChannelSelectMenu?.()) && isSetupChannelsInteraction(interaction.customId)) return runMatchedHandler(handlers.handleSetupChannelsInteraction, interaction)
  if (interaction.isButton() && isSetupUnsafeRoleInteraction(interaction.customId)) return runMatchedHandler(handlers.handleSetupUnsafeRoleInteraction, interaction)
  if (interaction.isButton() && isGameLogDecisionInteraction(interaction.customId)) return runMatchedHandler(handlers.handleGameLogInteraction, interaction)
  if (interaction.isButton() && isStorytellerRequestInteraction(interaction.customId)) return runMatchedHandler(handlers.handleStorytellerRequestInteraction, interaction)
  if (interaction.isButton() && isRequestDecisionInteraction(interaction.customId)) return runMatchedHandler(handlers.handleRequestDecisionInteraction, interaction)
  if (interaction.isButton() && isPrivateVoiceRequestInteraction(interaction.customId)) return runMatchedHandler(handlers.handlePrivateVoiceRequestInteraction, interaction)
  if ((interaction.isStringSelectMenu() || interaction.isButton()) && isNightActionInteraction(interaction.customId)) return runMatchedHandler(handlers.handleNightActionInteraction, interaction)
  if (interaction.isButton() && isNominationRequestInteraction(interaction.customId)) return runMatchedHandler(handlers.handleNominationRequestInteraction, interaction)
  if ((interaction.isButton() || interaction.isStringSelectMenu()) && isVotingInteraction(interaction.customId)) return runMatchedHandler(handlers.handleVotingInteraction, interaction)
  if ((interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) && isPlayerGrimoireInteraction(interaction.customId)) return runMatchedHandler(handlers.handlePlayerGrimoireInteraction, interaction)
  if ((interaction.isStringSelectMenu() || interaction.isButton()) && isSetupSettingsInteraction(interaction.customId)) return runMatchedHandler(handlers.handleSetupSettingsInteraction, interaction)
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && isStorytellerDashboardAction(interaction.customId)) return runMatchedHandler(handlers.handleStorytellerDashboardInteraction, interaction)
  if ((interaction.isButton() || interaction.isStringSelectMenu()) && isGamePanelInteraction(interaction)) return runMatchedHandler(handlers.handleGamePanelInteraction, interaction)
  if (interaction.isButton()) return { matched: true, result: await handleGenericButton(interaction, handlers.handleGamePanelInteraction) }
  return { matched: false, result: null }
}

async function runMatchedHandler(handler, interaction) {
  if (typeof handler !== 'function') return { matched: true, result: null }
  return { matched: true, result: await handler(interaction) }
}

function handleGenericButton(interaction, handleGamePanelInteraction) {
  if (isGamePanelAction(interaction.customId)) return handleGamePanelInteraction(interaction)
  return respondPrivateSystem(interaction, 'Unknown control', 'That button is from an old, missing, or unsupported bot panel.', 'Refresh the relevant panel, then try the current button.')
}

function handleUnhandledComponent(interaction) {
  return respondPrivateSystem(
    interaction,
    'Unknown control',
    'That control is from an old, missing, or unsupported bot panel.',
    'Refresh the relevant panel, then try the current control.'
  )
}

function handleUnknownCommand(interaction) {
  return respondPrivateSystem(
    interaction,
    'Unknown command',
    'That slash command is from an old or undeployed command menu.',
    'Run the current command from Discord again, or ask an admin to redeploy slash commands if it keeps appearing.'
  )
}

function handleInteractionCrash(interaction) {
  return respondPrivateSystem(
    interaction,
    'Action failed',
    'Something went wrong while handling that interaction.',
    'Refresh the relevant panel, then try again. If it repeats, send Jay the bot logs around this action.'
  ).catch(() => null)
}

function isUnhandledComponent(interaction) {
  return interaction.isButton?.() ||
    interaction.isStringSelectMenu?.() ||
    interaction.isChannelSelectMenu?.() ||
    interaction.isModalSubmit?.()
}

function hasInteractionResponse(interaction) {
  return interaction.deferred === true || interaction.replied === true
}

async function ensureCommandEnvironment(interaction, serverConfig, ctx) {
  const configuredChannels = await ctx.getConfiguredChannels(interaction, serverConfig)
  const missingPermissions = getMissingBotPermissions(interaction.guild, configuredChannels.filter(Boolean), getCleanupChannels(configuredChannels, serverConfig))
  if (missingPermissions.length) {
    return replyPrivateSystem(interaction, 'Permissions needed', formatMissingBotPermissions(missingPermissions), 'Ask an admin to grant the listed permissions, then rerun `/setup` if needed.')
  }
  const rolesReady = await ctx.gameManager.ensureGameRoles(interaction.guild)
  if (!rolesReady.ok) return replyPrivateSystem(interaction, 'Role setup needed', rolesReady.message, 'Move the bot role above the game roles, then rerun `/setup`.')
  return null
}

function isHelpButton(interaction) {
  const help = interaction.client.commands.get('help')
  return help?.isHelpInteraction?.(interaction.customId)
}

module.exports = {
  createInteractionRouter,
  handleGenericButton,
  handleInteractionCrash,
  handleUnhandledComponent,
  handleUnknownCommand,
  hasInteractionResponse,
  isUnhandledComponent
}
