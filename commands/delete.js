const { PermissionFlagsBits } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  executeSetupDelete
} = require('../utils/setupDelete')

module.exports = {
  name: 'delete',
  description: 'Delete BOTC-managed setup channels and categories.',
  options: [],
  data: {
    name: 'delete',
    description: 'Delete BOTC-managed setup channels and categories.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeSetupDelete)
}
