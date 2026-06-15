const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  isFakeMember
} = require('../fakeMembers')

function createPrivateNightTextPermissions(guild, botUserId, view, playerId, member = null) {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.UseApplicationCommands
  ]

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    },
    {
      id: botUserId,
      allow: [
        ...allow,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels
      ],
      type: OverwriteType.Member
    }
  ]

  if (!isFakeMember(member)) {
    overwrites.push({
      id: playerId,
      allow,
      type: OverwriteType.Member
    })
  }

  if (view.storytellerId && view.storytellerId !== playerId) {
    overwrites.push({
      id: view.storytellerId,
      allow,
      type: OverwriteType.Member
    })
  }

  return overwrites
}

module.exports = {
  createPrivateNightTextPermissions
}
