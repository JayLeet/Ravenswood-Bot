const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  createSetupAccessChoicePayload
} = require('../utils/setupAccessChoice')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

module.exports = {
  name: 'setup',
  description: 'Automatically create or reuse the BOTC setup channels.',
  options: [],
  data: {
    name: 'setup',
    description: 'Automatically create or reuse the BOTC setup channels.',
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

  return {
    ok: true,
    ...createSetupAccessChoicePayload()
  }
}

module.exports.executeSetupCommand = executeSetupCommand
