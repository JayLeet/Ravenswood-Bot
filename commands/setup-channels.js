const {
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  createExistingSetupChannelSelection,
  createSetupChannelPickerPayload
} = require('../utils/setupChannelPicker')

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

  execute: wrapCommand(async interaction => ({
    ok: true,
    ...createSetupChannelPickerPayload(createExistingSetupChannelSelection(interaction.guild))
  }))
}
