const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  editPermissionOverwrite
} = require('./discord/permissionOverwriteActions')
const {
  permissionSetIncludes
} = require('./discord/permissionBits')
const {
  createBotLogger
} = require('./logger')

const STORYTELLER_CATEGORY_VOICE_CONTROLS = Object.freeze({
  MoveMembers: true,
  MuteMembers: true
})
const BOT_SETUP_CATEGORY_PERMISSIONS = Object.freeze({
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  UseApplicationCommands: true,
  ManageMessages: true,
  ManageChannels: true,
  Connect: true,
  Speak: true,
  Stream: true,
  MoveMembers: true,
  MuteMembers: true
})
const BOT_SETUP_CATEGORY_REQUIRED_PERMISSIONS = Object.freeze({
  ...BOT_SETUP_CATEGORY_PERMISSIONS,
  ManageRoles: true
})
const GRIMOIRE_SPECTATOR_CATEGORY_PERMISSIONS = Object.freeze({
  ViewChannel: true,
  Connect: false,
  ReadMessageHistory: true,
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  Speak: false,
  Stream: false
})
const HIDDEN_SPECTATOR_CATEGORY_PERMISSIONS = Object.freeze({
  ViewChannel: false
})
const log = createBotLogger({ subsystem: 'SetupCategoryPermissions' })

async function applyBotSetupCategoryAccess(category, guild) {
  const botId = guild?.members?.me?.id || guild?.client?.user?.id
  if (!botId) return { ok: false, error: new Error('Bot member id unavailable') }
  if (overwriteMatchesPermissions(getCachedOverwrite(category, botId), BOT_SETUP_CATEGORY_PERMISSIONS)) {
    return { ok: true, changed: false }
  }
  if (!category?.permissionOverwrites?.edit) {
    return { ok: false, error: new Error('Category permission overwrite API unavailable') }
  }

  return editPermissionOverwrite(
    category,
    botId,
    BOT_SETUP_CATEGORY_PERMISSIONS,
    { reason: 'BOTC allow bot setup category maintenance access', type: OverwriteType.Member }
  ).then(() => ({ ok: true, changed: true })).catch(err => {
    log.recoverable('edit-setup-category-overwrite', err, {
      categoryId: category?.id,
      guildId: category?.guildId || category?.guild?.id,
      targetId: botId,
      targetType: 'member'
    })
    return { ok: false, error: err }
  })
}

function createBotSetupCategoryOverwrites(guild) {
  const botId = guild?.members?.me?.id || guild?.client?.user?.id
  return botId ? [{
    id: botId,
    allow: permissionsObjectToAllowList(BOT_SETUP_CATEGORY_PERMISSIONS),
    type: OverwriteType.Member
  }] : []
}

function createSetupCategoryRoleOverwrites(gameRoles = {}) {
  return [
    createRoleOverwrite(gameRoles.storyteller?.id, STORYTELLER_CATEGORY_VOICE_CONTROLS),
    createRoleOverwrite(gameRoles.spectator?.id, HIDDEN_SPECTATOR_CATEGORY_PERMISSIONS),
    createRoleOverwrite(gameRoles.grimoireSpectator?.id, GRIMOIRE_SPECTATOR_CATEGORY_PERMISSIONS)
  ].filter(Boolean)
}

function getBotSetupCategoryPermissionBits() {
  return permissionsObjectToAllowList(BOT_SETUP_CATEGORY_REQUIRED_PERMISSIONS)
}

async function applyStorytellerVoiceControlsToCategory(category, gameRoles) {
  const roleId = gameRoles?.storyteller?.id
  return editCategoryOverwriteIfChanged(
    category,
    roleId,
    STORYTELLER_CATEGORY_VOICE_CONTROLS,
    'BOTC allow Storyteller voice controls in game category',
    OverwriteType.Role
  )
}

async function applySetupCategoryRoleAccess(category, guild, gameRoles = {}) {
  const specs = [
    {
      label: 'Storyteller',
      role: gameRoles.storyteller,
      permissions: STORYTELLER_CATEGORY_VOICE_CONTROLS,
      reason: 'BOTC allow Storyteller voice controls in game category'
    },
    {
      label: 'regular Spectator',
      role: gameRoles.spectator,
      permissions: HIDDEN_SPECTATOR_CATEGORY_PERMISSIONS,
      reason: 'BOTC hide game category from regular spectators'
    },
    {
      label: 'Grimoire Spectator',
      role: gameRoles.grimoireSpectator,
      permissions: GRIMOIRE_SPECTATOR_CATEGORY_PERMISSIONS,
      reason: 'BOTC allow grimoire spectator view-only game category access'
    }
  ]

  for (const spec of specs) {
    const result = await editRequiredCategoryOverwrite(category, spec)
    if (!result.ok) return { ...result, guild }
  }

  return { ok: true }
}

async function applyReadOnlyGrimoireSpectatorCategoryAccess(category, gameRoles) {
  const roleId = gameRoles?.grimoireSpectator?.id
  return editCategoryOverwriteIfChanged(
    category,
    roleId,
    GRIMOIRE_SPECTATOR_CATEGORY_PERMISSIONS,
    'BOTC allow grimoire spectator view-only game category access',
    OverwriteType.Role
  )
}

async function applyHiddenSpectatorCategoryAccess(category, gameRoles) {
  const roleId = gameRoles?.spectator?.id
  return editCategoryOverwriteIfChanged(
    category,
    roleId,
    HIDDEN_SPECTATOR_CATEGORY_PERMISSIONS,
    'BOTC hide game category from regular spectators',
    OverwriteType.Role
  )
}

async function editCategoryOverwriteIfChanged(category, roleId, permissions, reason, type = OverwriteType.Role) {
  const result = await editRequiredCategoryOverwrite(category, {
    permissions,
    reason,
    role: { id: roleId },
    type
  })
  return result.ok && result.changed
}

async function editRequiredCategoryOverwrite(category, spec) {
  const roleId = spec.role?.id
  if (!roleId) return { ok: true, changed: false, skipped: true }
  const existing = getCachedOverwrite(category, roleId)
  if (overwriteMatchesPermissions(existing, spec.permissions)) return { ok: true, changed: false }
  if (!category?.permissionOverwrites?.edit) {
    return { ok: false, error: new Error('Category permission overwrite API unavailable'), ...spec }
  }

  return editPermissionOverwrite(category, roleId, spec.permissions, {
    reason: spec.reason,
    type: spec.type || OverwriteType.Role
  })
    .then(() => ({ ok: true, changed: true }))
    .catch(err => {
      log.recoverable('edit-setup-category-overwrite', err, {
        categoryId: category?.id,
        guildId: category?.guildId || category?.guild?.id,
        roleId
      })
      return { ok: false, error: err, ...spec }
    })
}

function permissionsObjectToAllowList(permissions = {}) {
  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === true)
    .map(([name]) => PermissionFlagsBits[name])
    .filter(Boolean)
}

function permissionsObjectToDenyList(permissions = {}) {
  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === false)
    .map(([name]) => PermissionFlagsBits[name])
    .filter(Boolean)
}

function createRoleOverwrite(roleId, permissions = {}) {
  if (!roleId) return null
  const overwrite = {
    id: roleId,
    type: OverwriteType.Role
  }
  const allow = permissionsObjectToAllowList(permissions)
  const deny = permissionsObjectToDenyList(permissions)
  if (allow.length) overwrite.allow = allow
  if (deny.length) overwrite.deny = deny
  return overwrite
}

function getCachedOverwrite(category, roleId) {
  const overwrites = category?.permissionOverwrites
  if (Array.isArray(overwrites)) return overwrites.find(overwrite => overwrite.id === roleId) || null
  const cache = overwrites?.cache
  if (typeof cache?.get === 'function') return cache.get(roleId) || null
  if (Array.isArray(cache)) return cache.find(overwrite => overwrite.id === roleId) || null
  return null
}

function overwriteMatchesPermissions(overwrite, permissions = {}) {
  if (!overwrite) return false

  return Object.entries(permissions).every(([name, allowed]) => {
    const flag = PermissionFlagsBits[name]
    if (!flag) return false
    const hasAllow = permissionSetIncludes(overwrite.allow, flag)
    const hasDeny = permissionSetIncludes(overwrite.deny, flag)
    return allowed ? hasAllow && !hasDeny : hasDeny && !hasAllow
  })
}

function hasStorytellerVoiceControls(overwrite) {
  return Boolean(
    permissionSetIncludes(overwrite?.allow, PermissionFlagsBits.MoveMembers) &&
    permissionSetIncludes(overwrite?.allow, PermissionFlagsBits.MuteMembers)
  )
}

module.exports = {
  BOT_SETUP_CATEGORY_PERMISSIONS,
  GRIMOIRE_SPECTATOR_CATEGORY_PERMISSIONS,
  HIDDEN_SPECTATOR_CATEGORY_PERMISSIONS,
  STORYTELLER_CATEGORY_VOICE_CONTROLS,
  applyBotSetupCategoryAccess,
  applyHiddenSpectatorCategoryAccess,
  applyReadOnlyGrimoireSpectatorCategoryAccess,
  applySetupCategoryRoleAccess,
  applyStorytellerVoiceControlsToCategory,
  createBotSetupCategoryOverwrites,
  createSetupCategoryRoleOverwrites,
  getBotSetupCategoryPermissionBits,
  editCategoryOverwriteIfChanged,
  hasStorytellerVoiceControls,
  overwriteMatchesPermissions
}
