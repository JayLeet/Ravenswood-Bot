const {
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  SETUP_ACCESS_MODES,
  createSetupAccessChoicePayload
} = require('../utils/setupAccessChoice')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')
const {
  preflightSetupPermissions
} = require('../utils/setupPermissionPreflight')

const options = []

module.exports = {
  name: 'setup-manual',
  description: 'Open the manual BOTC setup picker.',
  options,
  data: {
    name: 'setup-manual',
    description: 'Open the manual BOTC setup picker.',
    options,
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeSetupManualCommand)
}

async function executeSetupManualCommand(interaction) {
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
    return { ok: false, error: { message: 'Only a server administrator or bot owner access user can run manual setup.' } }
  }

  const missingPermissions = await preflightSetupPermissions(interaction.guild)
  if (missingPermissions) {
    return { ok: false, error: missingPermissions }
  }

  return {
    ok: true,
    ...createSetupAccessChoicePayload({ mode: SETUP_ACCESS_MODES.manual })
  }
}

module.exports.executeSetupManualCommand = executeSetupManualCommand
