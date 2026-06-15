const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  findBotcAccessRole,
  getCachedRoles
} = require('./botcAccessRole')
const {
  findGrimoireSpectatorRole
} = require('./grimoireSpectatorRole')

const LOCKED_GAME_PANEL_DENIES = Object.freeze([
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.SendVoiceMessages,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
  PermissionFlagsBits.UseExternalApps
])
const READ_ONLY_TEXT_DENIES = Object.freeze([
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads
])
const ACCESS_ROLE_PUBLIC_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands
])
const GRIMOIRE_SPECTATOR_ROLE_SUFFIX = ' Spectator'

function getGameRoles(guild, gameManager) {
  return {
    botcAccess: findBotcAccessRole(guild),
    player: findRole(guild, gameManager.roleNames.player),
    spectator: findRole(guild, gameManager.roleNames.spectator),
    grimoireSpectator: findSetupGrimoireSpectatorRole(guild),
    storyteller: findRole(guild, gameManager.roleNames.storyteller)
  }
}

function findRole(guild, name) {
  if (!name) return null
  return getCachedRoles(guild).find(role => role.name === name) || null
}

function findSetupGrimoireSpectatorRole(guild) {
  return findGrimoireSpectatorRole(guild) ||
    getCachedRoles(guild).find(role =>
      role.id === 'grim-spectator-role' ||
      String(role.name || '').endsWith(GRIMOIRE_SPECTATOR_ROLE_SUFFIX) &&
        String(role.name || '').includes('Spectator')
    ) || null
}

function createChannelOverwrites(guild, config, gameRoles) {
  if (config.botcAccessPublic) return createBotcAccessPublicOverwrites(guild, gameRoles, config.lockedPanel)
  if (config.lockedPanel) return createLockedGamePanelOverwrites(guild, gameRoles)
  if (config.hiddenFromRoleKeys) return createHiddenFromRoleKeyOverwrites(guild, gameRoles, config.hiddenFromRoleKeys)
  if (config.allowedRoleKeys || config.readOnlyRoleKeys) {
    return createRoleKeyOverwrites(
      guild,
      gameRoles,
      config.allowedRoleKeys || [],
      config.readOnlyRoleKeys || []
    )
  }
  if (config.gameRolesOnly) {
    return createRoleKeyOverwrites(guild, gameRoles, [
      'player',
      'spectator',
      'grimoireSpectator',
      'storyteller'
    ])
  }
  if (!config.private) return []

  return createRoleKeyOverwrites(guild, gameRoles, ['storyteller'])
}

function createBotcAccessPublicOverwrites(guild, gameRoles, lockedPanel = false) {
  const overwrites = createBasePrivateOverwrites(guild)
  if (gameRoles.botcAccess?.id) {
    overwrites.push({
      id: gameRoles.botcAccess.id,
      allow: [...ACCESS_ROLE_PUBLIC_ALLOW],
      deny: lockedPanel ? [...LOCKED_GAME_PANEL_DENIES] : [...READ_ONLY_TEXT_DENIES],
      type: OverwriteType.Role
    })
  }
  return overwrites
}

function createHiddenFromRoleKeyOverwrites(guild, gameRoles, roleKeys) {
  const overwrites = []

  for (const roleKey of roleKeys) {
    const role = gameRoles[roleKey]
    if (role?.id) overwrites.push(createDeniedViewOverwrite(role.id))
  }

  if (guild.members.me?.id) overwrites.push(createBotTextOverwrite(guild.members.me.id))
  return overwrites
}

function createLockedGamePanelOverwrites(guild, gameRoles) {
  const overwrites = [createDeniedChatOverwrite(guild.id)]
  const roles = [
    gameRoles.player,
    gameRoles.spectator,
    gameRoles.grimoireSpectator,
    gameRoles.storyteller
  ]

  for (const role of roles) {
    if (role?.id) overwrites.push(createDeniedChatOverwrite(role.id))
  }

  if (guild.members.me?.id) {
    overwrites.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions
      ],
      type: OverwriteType.Member
    })
  }

  return overwrites
}

function createBotTextOverwrite(id) {
  return {
    id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels
    ],
    type: OverwriteType.Member
  }
}

function createDeniedChatOverwrite(id) {
  return { id, deny: [...LOCKED_GAME_PANEL_DENIES], type: OverwriteType.Role }
}

function createDeniedViewOverwrite(id) {
  return { id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role }
}

function createRoleKeyOverwrites(guild, gameRoles, roleKeys, readOnlyRoleKeys = []) {
  const overwrites = createBasePrivateOverwrites(guild)

  for (const roleKey of roleKeys) {
    const role = gameRoles[roleKey]
    if (role?.id) overwrites.push(createAllowedRoleOverwrite(role.id))
  }

  for (const roleKey of readOnlyRoleKeys) {
    const role = gameRoles[roleKey]
    if (role?.id) overwrites.push(createReadOnlyRoleOverwrite(role.id))
  }

  return overwrites
}

function createBasePrivateOverwrites(guild) {
  const overwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role }]

  if (guild.members.me?.id) {
    overwrites.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels
      ],
      type: OverwriteType.Member
    })
  }

  return overwrites
}

function createAllowedRoleOverwrite(roleId) {
  return {
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands
    ],
    type: OverwriteType.Role
  }
}

function createReadOnlyRoleOverwrite(roleId) {
  return {
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands
    ],
    deny: [...READ_ONLY_TEXT_DENIES],
    type: OverwriteType.Role
  }
}

module.exports = {
  LOCKED_GAME_PANEL_DENIES,
  READ_ONLY_TEXT_DENIES,
  createChannelOverwrites,
  findRole,
  getGameRoles
}
