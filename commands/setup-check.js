const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  getMissingBotSetupPermissions
} = require('../systems/discord/permissions')
const {
  formatSetupCheckReport,
  isSetupReportOk
} = require('../utils/setupDiagnostics')
const {
  findExistingAutoSetupCategory
} = require('../utils/setupAutoCategory')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

module.exports = {
  name: 'setup-check',
  description: 'Check whether BOTC setup can run.',
  options: [],
  data: {
    name: 'setup-check',
    description: 'Check whether BOTC setup can run.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(async interaction => {
    if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
      return {
        ok: false,
        error: { message: 'You need Administrator permission or bot owner access to run setup checks.' }
      }
    }

    const existingSetupCategory = await findExistingAutoSetupCategory(interaction.guild)
    const missingPermissions = getMissingBotSetupPermissions(interaction.guild, { existingSetupCategory })

    const report = {
      missingPermissions
    }
    report.ok = isSetupReportOk(report)

    return {
      ok: true,
      title: 'Setup check',
      message: formatSetupCheckReport(report)
    }
  })
}
