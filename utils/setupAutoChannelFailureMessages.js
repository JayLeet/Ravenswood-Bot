const { PermissionFlagsBits } = require('discord.js')
const {
  createSetupPermissionDiagnostics,
  formatSetupPermissionDiagnostics
} = require('./setupPermissionDiagnostics')
const {
  createBotSetupCategoryOverwrites,
  createSetupCategoryRoleOverwrites,
  getBotSetupCategoryPermissionBits
} = require('./setupCategoryPermissions')

function createCategoryCreationFailureMessage(guild, error = null) {
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageChannels
    ]
  })
  const reason = formatDiscordReason(error)
  return [
    'I could not create the Ravenswood Bluff category.',
    reason ? `Discord reason: ${reason}.` : 'Discord blocked the category creation before any BOTC channels were created.',
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function createCategoryAccessFailureMessage(guild, category, error = null) {
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    target: category,
    overwrites: createBotSetupCategoryOverwrites(guild),
    requiredChannelPermissions: getBotSetupCategoryPermissionBits()
  })
  return [
    `I could not refresh my permissions in ${category?.name || 'the Ravenswood Bluff category'}.`,
    `Discord blocked the category permission overwrite update for my bot member${formatDiscordErrorSuffix(error)}.`,
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function createCategoryRoleAccessFailureMessage(guild, category, failure = {}) {
  const roleName = failure.role?.name || failure.label || `<@&${failure.role?.id || 'role'}>`
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    target: category,
    overwrites: createSetupCategoryRoleOverwrites({
      [getRoleKey(failure.label)]: failure.role
    }),
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageRoles
    ]
  })
  return [
    `I could not refresh ${roleName} permissions in ${category?.name || 'the Ravenswood Bluff category'}.`,
    `Discord blocked the category permission overwrite update for ${roleName}${formatDiscordErrorSuffix(failure.error)}.`,
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function createTextChannelFailureMessage(config, category, guild, overwrites = []) {
  const categoryName = category?.name ? ` in ${category.name}` : ''
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    target: category,
    overwrites,
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles
    ]
  })
  return [
    `I could not create #${config.name}${categoryName}.`,
    'Discord blocked the channel creation or the permission overwrites for that channel.',
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function getRoleKey(label = '') {
  if (/storyteller/i.test(label)) return 'storyteller'
  if (/grimoire/i.test(label)) return 'grimoireSpectator'
  return 'spectator'
}

function formatDiscordReason(error) {
  const message = String(error?.message || '').trim()
  if (!message) return ''
  return message.replace(/\.+$/, '')
}

function formatDiscordErrorSuffix(error) {
  const reason = formatDiscordReason(error)
  const code = error?.code ? `code ${error.code}` : ''
  const details = [reason, code].filter(Boolean).join(', ')
  return details ? ` (${details})` : ''
}

module.exports = {
  createCategoryAccessFailureMessage,
  createCategoryCreationFailureMessage,
  createCategoryRoleAccessFailureMessage,
  createTextChannelFailureMessage
}
