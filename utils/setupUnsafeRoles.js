const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js')
const {
  BOTC_ACCESS_ROLE_NAME,
  getCachedRoles
} = require('./botcAccessRole')
const {
  GRIMOIRE_SPECTATOR_ROLE_NAME
} = require('./grimoireSpectatorRole')

const SETUP_UNSAFE_ROLE_PREFIX = 'botc:setup-unsafe:'
const SETUP_UNSAFE_ROLE_ACTIONS = Object.freeze({
  cancel: `${SETUP_UNSAFE_ROLE_PREFIX}cancel`,
  continue: `${SETUP_UNSAFE_ROLE_PREFIX}continue`
})
const DANGEROUS_ROLE_PERMISSIONS = Object.freeze([
  ['Administrator', PermissionFlagsBits.Administrator],
  ['Manage Roles', PermissionFlagsBits.ManageRoles],
  ['Manage Channels', PermissionFlagsBits.ManageChannels],
  ['Manage Server', PermissionFlagsBits.ManageGuild],
  ['Ban Members', PermissionFlagsBits.BanMembers],
  ['Kick Members', PermissionFlagsBits.KickMembers],
  ['Mention Everyone', PermissionFlagsBits.MentionEveryone]
])

function findUnsafeSetupRoles(guild, gameManager, options = {}) {
  const roleNames = getManagedRoleNames(gameManager, options)
  return roleNames
    .map(name => getCachedRoles(guild).find(role => role.name === name))
    .filter(Boolean)
    .map(role => ({
      role,
      permissions: getDangerousPermissions(role)
    }))
    .filter(entry => entry.permissions.length)
}

function getManagedRoleNames(gameManager, options = {}) {
  const names = new Set(Object.values(gameManager?.roleNames || {}))
  names.add(GRIMOIRE_SPECTATOR_ROLE_NAME)
  if (options.includeBotcAccessRole) names.add(BOTC_ACCESS_ROLE_NAME)
  return [...names].filter(Boolean)
}

function getDangerousPermissions(role) {
  return DANGEROUS_ROLE_PERMISSIONS
    .filter(([, bit]) => role?.permissions?.has?.(bit))
    .map(([label]) => label)
}

function createUnsafeSetupRolePayload(unsafeRoles, options = {}) {
  const privateAccess = !!options.privateAccess
  const description = [
    'Setup has not been saved yet.',
    privateAccess
      ? 'Private setup is blocked until these unsafe role permissions are fixed or an administrator explicitly continues private setup.'
      : 'Public setup is blocked until these unsafe role permissions are fixed or an administrator explicitly continues public setup.',
    'Continuing could let normal game actions grant users powerful server permissions.',
    '',
    formatUnsafeRoles(unsafeRoles)
  ].join('\n')

  return {
    embeds: [new EmbedBuilder()
      .setTitle('Unsafe role permissions detected')
      .setDescription(description.slice(0, 4096))
      .setColor(0xe74c3c)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createUnsafeContinueCustomId(privateAccess))
        .setLabel(privateAccess ? 'Continue private setup anyway' : 'Continue public setup anyway')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(SETUP_UNSAFE_ROLE_ACTIONS.cancel)
        .setLabel('Got it')
        .setStyle(ButtonStyle.Secondary)
    )]
  }
}

function createUnsafeContinueCustomId(privateAccess = false) {
  return `${SETUP_UNSAFE_ROLE_ACTIONS.continue}:${privateAccess ? 'private' : 'public'}`
}

function parseSetupUnsafeRoleCustomId(customId) {
  const text = String(customId || '')
  if (text === SETUP_UNSAFE_ROLE_ACTIONS.cancel) return { action: 'cancel', privateAccess: false }
  if (text === SETUP_UNSAFE_ROLE_ACTIONS.continue) return { action: 'continue', privateAccess: false }
  if (!text.startsWith(`${SETUP_UNSAFE_ROLE_ACTIONS.continue}:`)) return null
  const [, , , access] = text.split(':')
  if (!['private', 'public'].includes(access)) return null
  return { action: 'continue', privateAccess: access === 'private' }
}

function formatUnsafeRoles(unsafeRoles) {
  return unsafeRoles.map(({ role, permissions }) =>
    `• ${role.name}: ${permissions.join(', ')}`
  ).join('\n') || 'No unsafe BOTC roles found.'
}

function isSetupUnsafeRoleInteraction(customId) {
  return !!parseSetupUnsafeRoleCustomId(customId)
}

module.exports = {
  SETUP_UNSAFE_ROLE_ACTIONS,
  createUnsafeContinueCustomId,
  createUnsafeSetupRolePayload,
  findUnsafeSetupRoles,
  formatUnsafeRoles,
  isSetupUnsafeRoleInteraction,
  parseSetupUnsafeRoleCustomId
}
