const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  getMissingBotSetupPermissions
} = require('../systems/discord/permissions')
const {
  formatSetupCheckReport,
  isSetupReportOk
} = require('../utils/setupDiagnostics')
const {
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL
} = require('../utils/setupAutoChannels')
const {
  findExistingAutoSetupCategory
} = require('../utils/setupAutoCategory')
const {
  createChannelOverwrites,
  getGameRoles
} = require('../utils/setupTextChannelPermissions')
const {
  createSetupVoiceChannelPermissionOverwrites
} = require('../utils/setupVoiceChannels')
const {
  createSetupCategoryRoleOverwrites
} = require('../utils/setupCategoryPermissions')
const {
  validateSetupPermissionOverwriteTargets
} = require('../utils/setupPermissionOverwritePreflight')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

module.exports = {
  name: 'setup-check',
  description: 'Check whether the bot setup and permissions look ready.',
  options: [],
  data: {
    name: 'setup-check',
    description: 'Check whether the bot setup and permissions look ready.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(async (interaction, { gameManager, serverConfigs }) => {
    if (!hasAdministrator(interaction)) {
      return {
        ok: false,
        error: { message: 'You need Administrator permission or bot owner access to run setup checks.' }
      }
    }

    const existingSetupCategory = await findExistingAutoSetupCategory(interaction.guild)
    const missingPermissions = getMissingBotSetupPermissions(interaction.guild, { existingSetupCategory })

    let rolesReady = await gameManager.ensureGameRoles(interaction.guild)
    if (rolesReady.ok) {
      const gameRoles = getGameRoles(interaction.guild, gameManager)
      const overwrites = Object.values(AUTO_SETUP_CHANNELS)
        .concat(AUTO_SETUP_GAME_LOG_CHANNEL)
        .flatMap(config => createChannelOverwrites(interaction.guild, config, gameRoles))
        .concat(createSetupVoiceChannelPermissionOverwrites(interaction.guild, gameRoles))
        .concat(createSetupCategoryRoleOverwrites(gameRoles))
      rolesReady = validateSetupPermissionOverwriteTargets(interaction.guild, overwrites)
    }
    const report = {
      missingPermissions,
      rolesReady
    }
    report.ok = isSetupReportOk(report)

    return {
      ok: true,
      title: 'Setup check',
      message: formatSetupCheckReport(report)
    }
  })
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports.hasAdministrator = hasAdministrator
