const {
  OverwriteType
} = require('discord.js')
const {
  editPermissionOverwrite
} = require('../../../utils/discord/permissionOverwriteActions')
const {
  createSingleFlight
} = require('../../../utils/discord/singleFlight')
const {
  createSetupSettingsPayload,
  getSetupSettingsProfile,
  hasAdminSetupSettingsAccess,
  isSetupSettingsInteraction,
  normalizeSetupSettingsState,
  parseSetupSettingsCustomId,
  parseSetupSettingsSelect,
  resolveSetupSettingsChannel,
  resolveSetupSettingsRole
} = require('../../../utils/setupSettingsPanel')
const {
  getGameRoles
} = require('../../../utils/setupTextChannelPermissions')
const {
  acknowledgeInteraction,
  createSystemEmbed,
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  logSetupRecoverable
} = require('../../../utils/setupLogging')

function createSetupSettingsPanelSystem({ gameManager, serverConfigs }) {
  const singleFlight = createSingleFlight({ ttlMs: 10000 })

  async function handleSetupSettingsInteraction(interaction) {
    const ready = validateSetupSettingsInteraction(interaction)
    if (!ready.ok) return replyPrivateSystem(interaction, ready.title, ready.message, ready.suggestion)

    const serverConfig = serverConfigs.get(interaction.guild.id)
    await interaction.guild.channels.fetch?.().catch(err => logSetupRecoverable('fetch-setup-settings-channels', err, createSetupSettingsContext(interaction)))
    await interaction.guild.roles.fetch?.().catch(err => logSetupRecoverable('fetch-setup-settings-roles', err, createSetupSettingsContext(interaction)))
    const gameRoles = getGameRoles(interaction.guild, gameManager)

    if (interaction.isStringSelectMenu?.()) {
      const state = parseSetupSettingsSelect(interaction, getStateFromMessage(interaction))
      return updateSettings(interaction, serverConfig, gameRoles, state)
    }

    const parsed = parseSetupSettingsCustomId(interaction.customId)
    if (!parsed || parsed.action === 'home' || parsed.action === 'back' || parsed.action === 'role' || parsed.action === 'channel') {
      return updateSettings(interaction, serverConfig, gameRoles, parsed?.state || { view: 'roles' })
    }

    if (parsed.action === 'toggle' || parsed.action === 'apply') {
      return runSetupSettingsFlight(interaction, singleFlight, () => {
        if (parsed.action === 'toggle') return toggleSetupPermission(interaction, serverConfig, gameRoles, parsed)
        return applySetupPermissionProfile(interaction, serverConfig, gameRoles, parsed)
      })
    }

    return null
  }

  async function toggleSetupPermission(interaction, serverConfig, gameRoles, parsed) {
    const selected = normalizeSetupSettingsState(parsed.state)
    const channel = resolveSetupSettingsChannel(interaction.guild, serverConfig, selected.channelKey)
    const role = resolveSetupSettingsRole(gameRoles, selected.roleKey)
    if (!channel || !role?.id || !parsed.permissionName) return unavailable(interaction)

    const changed = await editPermissionOverwrite(
      channel,
      role.id,
      { [parsed.permissionName]: parsed.target === 'on' },
      { reason: 'BOTC setup settings permission toggle', type: OverwriteType.Role }
    ).catch(err => { logSetupRecoverable('toggle-setup-settings-permission', err, { ...createSetupSettingsContext(interaction), channelId: channel.id, permissionName: parsed.permissionName, roleId: role.id }); return false })

    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        changed ? 'Permission updated' : 'Permission already matched',
        `${role} permission **${parsed.permissionName}** is now **${parsed.target === 'on' ? 'enabled' : 'disabled'}** in <#${channel.id}>.`,
        changed ? 0x2ecc71 : 0x95a5a6
      )],
      components: createSetupSettingsPayload({
        guild: interaction.guild,
        serverConfig,
        gameRoles,
        state: selected
      }).components
    })
  }

  async function applySetupPermissionProfile(interaction, serverConfig, gameRoles, state) {
    const selected = normalizeSetupSettingsState(state)
    const channel = resolveSetupSettingsChannel(interaction.guild, serverConfig, selected.channelKey)
    const role = resolveSetupSettingsRole(gameRoles, selected.roleKey)
    const profile = getSetupSettingsProfile(selected.profileKey)
    if (!channel || !role?.id) return unavailable(interaction)

    const changed = await editPermissionOverwrite(
      channel,
      role.id,
      profile.permissions,
      { reason: 'BOTC setup settings permission profile', type: OverwriteType.Role }
    ).catch(err => { logSetupRecoverable('apply-setup-settings-permission-profile', err, { ...createSetupSettingsContext(interaction), channelId: channel.id, profileKey: selected.profileKey, roleId: role.id }); return false })

    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        changed ? 'Settings updated' : 'Settings already matched',
        `${role} now uses **${profile.label}** permissions in <#${channel.id}>.`,
        changed ? 0x2ecc71 : 0x95a5a6
      )],
      components: createSetupSettingsPayload({ guild: interaction.guild, serverConfig, gameRoles, state: selected }).components
    })
  }

  return {
    getRuntimeState: (...args) => singleFlight.getRuntimeState(...args),
    handleSetupSettingsInteraction
  }
}

function createSetupSettingsContext(interaction) {
  return { guildId: interaction.guild?.id, messageId: interaction.message?.id, userId: interaction.user?.id }
}

async function runSetupSettingsFlight(interaction, singleFlight, fn) {
  const key = [interaction.guild?.id, interaction.member?.id, interaction.customId].join(':')
  const result = await singleFlight.run(key, fn)
  if (!result.skipped) return result.value
  return acknowledgeInteraction(interaction)
}

function updateSettings(interaction, serverConfig, gameRoles, state) {
  return updateInteraction(interaction, createSetupSettingsPayload({
    guild: interaction.guild,
    serverConfig,
    gameRoles,
    state
  }))
}

function unavailable(interaction) {
  return replyPrivateSystem(
    interaction,
    'Settings unavailable',
    'That role or channel could not be found.',
    'Rerun `/setup`, then reopen Settings from the game lobby help panel.'
  )
}

function validateSetupSettingsInteraction(interaction) {
  if (!hasAdminSetupSettingsAccess(interaction)) {
    return {
      ok: false,
      title: 'Admin only',
      message: 'Only server administrators or bot owner access users can use setup settings.',
      suggestion: 'Ask a server administrator or the bot owner access user to change BOTC channel permissions.'
    }
  }

  return { ok: true }
}

function getStateFromMessage(interaction) {
  const components = interaction.message?.components || []
  const selected = {}

  for (const row of components) {
    const data = typeof row?.toJSON === 'function' ? row.toJSON() : row
    for (const component of data?.components || []) {
      const option = (component.options || []).find(item => item.default)
      if (!option) continue
      if (component.custom_id?.endsWith(':role')) selected.roleKey = option.value
      if (component.custom_id?.endsWith(':channel')) selected.channelKey = option.value
      if (component.custom_id?.endsWith(':profile')) selected.profileKey = option.value
    }
  }

  return normalizeSetupSettingsState(selected)
}

module.exports = {
  createSetupSettingsPanelSystem,
  isSetupSettingsInteraction,
  runSetupSettingsFlight
}
