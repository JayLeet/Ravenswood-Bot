const {
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  createSetupAccessChoicePayload,
  SETUP_ACCESS_MODES
} = require('../utils/setupAccessChoice')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

const options = []

module.exports = {
  name: 'setup-channels',
  description: 'Choose BOTC setup channels manually.',
  options,
  data: {
    name: 'setup-channels',
    description: 'Choose BOTC setup channels manually.',
    options,
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeSetupChannelsCommand)
}

async function executeSetupChannelsCommand(interaction) {
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
    return { ok: false, error: { message: 'Only a server administrator or bot owner access user can choose setup channels.' } }
  }

  return {
    ok: true,
    ...createSetupAccessChoicePayload({ mode: SETUP_ACCESS_MODES.manual })
  }
}

module.exports.executeSetupChannelsCommand = executeSetupChannelsCommand
