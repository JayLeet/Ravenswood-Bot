const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  createSetupModeChoicePayload
} = require('../utils/setupAccessChoice')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')
const {
  preflightSetupPermissions
} = require('../utils/setupPermissionPreflight')

module.exports = {
  name: 'setup',
  description: 'Open guided BOTC setup.',
  options: [],
  data: {
    name: 'setup',
    description: 'Open guided BOTC setup.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeSetupCommand)
}

async function executeSetupCommand(interaction) {
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
    return { ok: false, error: { message: 'Only a server administrator or bot owner access user can run setup.' } }
  }

  const missingPermissions = await preflightSetupPermissions(interaction.guild)
  if (missingPermissions) {
    return { ok: false, error: missingPermissions }
  }

  return {
    ok: true,
    ...createSetupModeChoicePayload()
  }
}

module.exports.executeSetupCommand = executeSetupCommand
