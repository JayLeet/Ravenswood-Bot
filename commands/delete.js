const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  executeSetupDelete
} = require('../utils/setupDelete')

module.exports = {
  name: 'delete',
  description: 'Delete BOTC Bot setup channels and categories.',
  options: [],
  data: {
    name: 'delete',
    description: 'Delete BOTC Bot setup channels and categories.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeSetupDelete)
}

module.exports.executeSetupDeleteCommand = executeSetupDelete
