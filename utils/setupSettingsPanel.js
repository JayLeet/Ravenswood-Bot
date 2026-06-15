const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  CHANNEL_LABELS,
  ROLE_LABELS,
  SETUP_PERMISSION_PROFILES,
  SETUP_SETTINGS_APPLY_PREFIX,
  SETUP_SETTINGS_BACK_PREFIX,
  SETUP_SETTINGS_CHANNEL_PREFIX,
  SETUP_SETTINGS_CHANNEL_SELECT_ID,
  SETUP_SETTINGS_DEFAULTS,
  SETUP_SETTINGS_HOME_ID,
  SETUP_SETTINGS_PERMISSION_ROWS,
  SETUP_SETTINGS_PROFILE_SELECT_ID,
  SETUP_SETTINGS_ROLE_EMOJI,
  SETUP_SETTINGS_ROLE_PREFIX,
  SETUP_SETTINGS_ROLE_SELECT_ID,
  SETUP_SETTINGS_TOGGLE_PREFIX,
  SETUP_SETTING_CHANNEL_KEYS,
  SETUP_SETTING_ROLE_KEYS,
  SETUP_SETTINGS_PREFIX
} = require('./setupSettingsConfig')
const {
  getSetupPermissionState
} = require('./setupSettingsPermissionState')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('./commandAccess')

function isSetupSettingsInteraction(customId) {
  return String(customId || '').startsWith(SETUP_SETTINGS_PREFIX)
}

function createSetupSettingsPayload({ guild, serverConfig, gameRoles, state = {} }) {
  const selected = normalizeSetupSettingsState(state)
  if (selected.view === 'permissions') return createPermissionPayload({ guild, serverConfig, gameRoles, state: selected })
  if (selected.view === 'channels') return createChannelPayload({ guild, serverConfig, gameRoles, state: selected })
  return createRolePayload({ gameRoles })
}

function createRolePayload({ gameRoles }) {
  const roleButtons = createRoleOptions(gameRoles).map(createRoleButton)
  return {
    embeds: [createSettingsEmbed('BOTC Setup Settings', [
      'Admin-only permission tools for BOTC-managed roles and setup channels.',
      'Choose the game role you want to edit.'
    ].join('\n'))],
    components: rowsFromButtons([...roleButtons, createBackButton(SETUP_SETTINGS_HOME_ID, 'Back')])
  }
}

function createChannelPayload({ guild, serverConfig, gameRoles, state }) {
  const role = resolveSetupSettingsRole(gameRoles, state.roleKey)
  const channelButtons = createChannelOptions(serverConfig)
    .map(option => createChannelButton(guild, serverConfig, role, state.roleKey, option))
  return {
    embeds: [createSettingsEmbed('Choose Channel', [
      `Role: ${role?.label || formatRoleLabel(state.roleKey)}`,
      'Choose a text or voice channel to edit for this role.',
      'Green ✅ channels are currently visible to this role.',
      'Red ❌ channels are currently hidden from this role.'
    ].join('\n'))],
    components: rowsFromButtons([...channelButtons, createBackButton(`${SETUP_SETTINGS_BACK_PREFIX}roles`, 'Back')])
  }
}

function createPermissionPayload({ guild, serverConfig, gameRoles, state }) {
  const role = resolveSetupSettingsRole(gameRoles, state.roleKey)
  const channel = resolveSetupSettingsChannel(guild, serverConfig, state.channelKey)
  const channelType = getSetupSettingsChannelType(state.channelKey)
  const permissionButtons = SETUP_SETTINGS_PERMISSION_ROWS[channelType]
    .map(([permissionName, label]) => createPermissionToggleButton(channel, role, state, permissionName, label))

  return {
    embeds: [createSettingsEmbed('Edit Permissions', [
      `Role: ${formatRoleLabel(state.roleKey)}`,
      `Channel: ${formatChannelLabel(state.channelKey)}`,
      'Green ✅ buttons are enabled permissions.',
      'Red ❌ buttons are disabled permissions.'
    ].join('\n'))],
    components: rowsFromButtons([
      ...permissionButtons,
      createBackButton(`${SETUP_SETTINGS_BACK_PREFIX}channels:${state.roleKey}`, 'Back')
    ])
  }
}

function createSettingsEmbed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x34495e).setTimestamp()
}

function createRoleButton(option) {
  return new ButtonBuilder()
    .setCustomId(`${SETUP_SETTINGS_ROLE_PREFIX}${option.value}`)
    .setEmoji(option.emoji)
    .setLabel(option.label)
    .setStyle(ButtonStyle.Secondary)
}

function createChannelButton(guild, serverConfig, role, roleKey, option) {
  const channel = resolveSetupSettingsChannel(guild, serverConfig, option.value)
  const { enabled } = getSetupPermissionState(channel, role, 'ViewChannel')
  return new ButtonBuilder()
    .setCustomId(`${SETUP_SETTINGS_CHANNEL_PREFIX}${roleKey}:${option.value}`)
    .setEmoji(enabled ? '✅' : '❌')
    .setLabel(option.label)
    .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
}

function createPermissionToggleButton(channel, role, state, permissionName, label) {
  const { enabled } = getSetupPermissionState(channel, role, permissionName)
  return new ButtonBuilder()
    .setCustomId(`${SETUP_SETTINGS_TOGGLE_PREFIX}${state.roleKey}:${state.channelKey}:${permissionName}:${enabled ? 'off' : 'on'}`)
    .setEmoji(enabled ? '✅' : '❌')
    .setLabel(label)
    .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
}

function createBackButton(customId, label) {
  return new ButtonBuilder().setCustomId(customId).setEmoji('⬅️').setLabel(label).setStyle(ButtonStyle.Secondary)
}

function rowsFromButtons(buttons) {
  const rows = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)))
  }
  return rows.slice(0, 5)
}

function parseSetupSettingsCustomId(customId) {
  const value = String(customId || '')
  if (value === SETUP_SETTINGS_HOME_ID) return { action: 'home', state: { view: 'roles' } }
  if (value === `${SETUP_SETTINGS_BACK_PREFIX}roles`) return { action: 'back', state: { view: 'roles' } }
  if (value.startsWith(`${SETUP_SETTINGS_BACK_PREFIX}channels:`)) return parseSettingsBack(value)
  if (value.startsWith(SETUP_SETTINGS_ROLE_PREFIX)) return parseSettingsRole(value)
  if (value.startsWith(SETUP_SETTINGS_CHANNEL_PREFIX)) return parseSettingsChannel(value)
  if (value.startsWith(SETUP_SETTINGS_TOGGLE_PREFIX)) return parseSettingsToggle(value)
  if (value.startsWith(SETUP_SETTINGS_APPLY_PREFIX)) return parseSettingsApply(value)
  return null
}

function parseSettingsBack(value) {
  const roleKey = value.slice(`${SETUP_SETTINGS_BACK_PREFIX}channels:`.length)
  return { action: 'back', state: normalizeSetupSettingsState({ roleKey, view: 'channels' }) }
}

function parseSettingsRole(value) {
  const roleKey = value.slice(SETUP_SETTINGS_ROLE_PREFIX.length)
  return { action: 'role', state: normalizeSetupSettingsState({ roleKey, view: 'channels' }) }
}

function parseSettingsChannel(value) {
  const [roleKey, channelKey] = value.slice(SETUP_SETTINGS_CHANNEL_PREFIX.length).split(':')
  return { action: 'channel', state: normalizeSetupSettingsState({ channelKey, roleKey, view: 'permissions' }) }
}

function parseSettingsToggle(value) {
  const [roleKey, channelKey, permissionName, target] = value.slice(SETUP_SETTINGS_TOGGLE_PREFIX.length).split(':')
  return { action: 'toggle', permissionName, target, state: normalizeSetupSettingsState({ channelKey, roleKey, view: 'permissions' }) }
}

function parseSettingsApply(value) {
  const [roleKey, channelKey, profileKey] = value.slice(SETUP_SETTINGS_APPLY_PREFIX.length).split(':')
  return { action: 'apply', ...normalizeSetupSettingsState({ roleKey, channelKey, profileKey, view: 'permissions' }) }
}

function parseSetupSettingsSelect(interaction, current = {}) {
  const value = interaction.values?.[0]
  const state = normalizeSetupSettingsState(current)
  if (interaction.customId === SETUP_SETTINGS_ROLE_SELECT_ID) return normalizeSetupSettingsState({ ...state, roleKey: value, view: 'channels' })
  if (interaction.customId === SETUP_SETTINGS_CHANNEL_SELECT_ID) return normalizeSetupSettingsState({ ...state, channelKey: value, view: 'permissions' })
  if (interaction.customId === SETUP_SETTINGS_PROFILE_SELECT_ID) return normalizeSetupSettingsState({ ...state, profileKey: value })
  return state
}

function normalizeSetupSettingsState(state = {}) {
  return {
    channelKey: SETUP_SETTING_CHANNEL_KEYS.includes(state.channelKey) ? state.channelKey : SETUP_SETTINGS_DEFAULTS.channelKey,
    profileKey: SETUP_PERMISSION_PROFILES[state.profileKey] ? state.profileKey : SETUP_SETTINGS_DEFAULTS.profileKey,
    roleKey: SETUP_SETTING_ROLE_KEYS.includes(state.roleKey) ? state.roleKey : SETUP_SETTINGS_DEFAULTS.roleKey,
    view: ['roles', 'channels', 'permissions'].includes(state.view) ? state.view : SETUP_SETTINGS_DEFAULTS.view
  }
}

function getSetupSettingsProfile(profileKey) {
  return SETUP_PERMISSION_PROFILES[profileKey] || SETUP_PERMISSION_PROFILES[SETUP_SETTINGS_DEFAULTS.profileKey]
}

function resolveSetupSettingsChannel(guild, serverConfig, channelKey) {
  const channelId = getSetupSettingsChannelId(serverConfig, channelKey)
  if (!channelId) return null
  const cache = guild?.channels?.cache
  if (typeof cache?.get === 'function') return cache.get(channelId) || null
  if (Array.isArray(cache)) return cache.find(channel => channel.id === channelId) || null
  if (typeof cache?.values === 'function') return [...cache.values()].find(channel => channel.id === channelId) || null
  return null
}

function getSetupSettingsChannelId(serverConfig, channelKey) {
  const ids = {
    gameChannel: serverConfig?.gameChannelId,
    gameLogChannel: serverConfig?.gameLogChannelId,
    liveChannel: serverConfig?.liveChannelId,
    playerGrimoireChannel: serverConfig?.playerGrimoireChannelId,
    postGameChannel: serverConfig?.postGameChannelId,
    spectatorChannel: serverConfig?.spectatorChannelId,
    storytellerChannel: serverConfig?.storytellerChannelId,
    waitingRoomVoiceChannel: serverConfig?.waitingRoomVoiceChannelId
  }
  return ids[channelKey] || null
}

function resolveSetupSettingsRole(gameRoles, roleKey) {
  return gameRoles?.[roleKey] || null
}

function createChannelOptions(serverConfig) {
  return SETUP_SETTING_CHANNEL_KEYS
    .map(channelKey => ({ channelKey, channelId: getSetupSettingsChannelId(serverConfig, channelKey) }))
    .filter(entry => entry.channelId)
    .map(entry => ({
      emoji: getSetupSettingsChannelType(entry.channelKey) === 'voice' ? '🔊' : '💬',
      label: formatChannelLabel(entry.channelKey),
      type: getSetupSettingsChannelType(entry.channelKey),
      value: entry.channelKey
    }))
}

function createRoleOptions(gameRoles) {
  return SETUP_SETTING_ROLE_KEYS
    .map(roleKey => ({ roleKey, role: gameRoles?.[roleKey] }))
    .filter(entry => entry.role?.id)
    .map(entry => ({ emoji: SETUP_SETTINGS_ROLE_EMOJI[entry.roleKey], label: formatRoleLabel(entry.roleKey), value: entry.roleKey }))
}

function getSetupSettingsChannelType(channelKey) {
  return channelKey === 'waitingRoomVoiceChannel' ? 'voice' : 'text'
}

function isPermissionEnabled(channel, role, permissionName) {
  return getSetupPermissionState(channel, role, permissionName).enabled
}

function formatChannelLabel(channelKey) {
  return CHANNEL_LABELS[channelKey] || channelKey
}

function formatRoleLabel(roleKey) {
  return ROLE_LABELS[roleKey] || roleKey
}

function hasAdminSetupSettingsAccess(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = {
  SETUP_PERMISSION_PROFILES,
  SETUP_SETTINGS_CHANNEL_SELECT_ID,
  SETUP_SETTINGS_HOME_ID,
  SETUP_SETTINGS_PROFILE_SELECT_ID,
  SETUP_SETTINGS_ROLE_SELECT_ID,
  createSetupSettingsPayload,
  getSetupSettingsProfile,
  hasAdminSetupSettingsAccess,
  isPermissionEnabled,
  isSetupSettingsInteraction,
  normalizeSetupSettingsState,
  parseSetupSettingsCustomId,
  parseSetupSettingsSelect,
  resolveSetupSettingsChannel,
  resolveSetupSettingsRole
}
