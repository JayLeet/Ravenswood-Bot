const {
  ApplicationCommandOptionType,
  EmbedBuilder
} = require('discord.js')
const { listScripts } = require('../systems/game/scripts')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  respondAutocomplete
} = require('../systems/discord/interactions/feedback')
const {
  formatRoleNameWithEmoji
} = require('../utils/roleFormatting')

const MAX_AUTOCOMPLETE_CHOICES = 25
const SCRIPT_TEAMS = Object.freeze([
  ['townsfolk', 'Townsfolk'],
  ['outsider', 'Outsiders'],
  ['minion', 'Minions'],
  ['demon', 'Demons']
])

module.exports = {
  name: 'script',
  description: 'Show the current script and its characters.',
  options: [
    {
      name: 'name',
      description: 'Optional: Storyteller-only script choice before the game starts.',
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: true
    }
  ],
  data: {
    name: 'script',
    description: 'Show the current script and its characters.',
    options: [
      {
        name: 'name',
        description: 'Optional: Storyteller-only script choice before the game starts.',
        type: ApplicationCommandOptionType.String,
        required: false,
        autocomplete: true
      }
    ]
  },

  execute: wrapCommand(async (interaction, ctx) => {
    const { gameLifecycle, serverConfig } = ctx
    const requestedScript = interaction.options.getString('name')
    let script = null

    if (requestedScript) {
      if (serverConfig?.storytellerChannelId && interaction.channelId !== serverConfig.storytellerChannelId) {
        return gameLifecycle.createError(
          gameLifecycle.errorTypes.INVALID_STATE,
          `Use the script picker in <#${serverConfig.storytellerChannelId}> when changing scripts.`
        )
      }

      const result = await gameLifecycle.setScript(
        interaction.guild.id,
        interaction.member,
        requestedScript
      )
      if (!result.ok) return result
      script = result.script
    }

    script ||= getCurrentScript(interaction, gameLifecycle)

    return {
      ok: true,
      embeds: [createScriptEmbed(script)]
    }
  }, { ephemeral: true }),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused() || ''
    return respondAutocomplete(interaction, getScriptAutocompleteChoices(focused))
  },

  createScriptEmbed,
  getScriptAutocompleteChoices
}

function getCurrentScript(interaction, gameLifecycle) {
  const game = interaction.guild?.id
    ? gameLifecycle.get(interaction.guild.id)
    : null
  return gameLifecycle.scripts.getScript(game?.scriptId) || gameLifecycle.scripts.getDefaultScript()
}

function createScriptEmbed(script) {
  const view = createScriptRoleView(script)
  const embed = new EmbedBuilder()
    .setTitle(script.name)
    .setDescription(createScriptDescription(script))
    .setColor(0x9b59b6)
    .setTimestamp()

  for (const [team, label] of SCRIPT_TEAMS) {
    embed.addFields({
      name: label,
      value: formatScriptTeamRoles(script, team, view),
      inline: false
    })
  }

  return embed
}

function createScriptDescription(script) {
  const support = formatSupportStatus(script.setup?.supportStatus)
  return [
    `Edition: ${script.setup?.edition || 'custom'}`,
    support ? `Support: ${support}` : null,
    script.setup?.supportNote || null
  ].filter(Boolean).join('\n')
}

function formatScriptTeamRoles(script, team, view) {
  const roles = (script.roles || []).filter(role => role.team === team)
  if (!roles.length) return 'None'
  return roles.map(role => formatRoleNameWithEmoji(view, role.id)).join('\n')
}

function createScriptRoleView(script) {
  return {
    engine: {
      roleCategories: createScriptRoleCategories(script),
      roleNames: Object.fromEntries((script.roles || []).map(role => [role.id, role.name]))
    }
  }
}

function createScriptRoleCategories(script) {
  return Object.fromEntries(SCRIPT_TEAMS.map(([team]) => [
    team,
    (script.roles || []).filter(role => role.team === team).map(role => role.id)
  ]))
}

function getScriptAutocompleteChoices(query = '') {
  const search = normalizeSearch(query)

  return listScripts()
    .filter(script => matchesScript(script, search))
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
    .map(script => ({
      name: formatScriptChoiceName(script),
      value: script.id
    }))
}

function matchesScript(script, search) {
  if (!search) return true

  return normalizeSearch(script.name).includes(search) ||
    normalizeSearch(script.id).includes(search) ||
    normalizeSearch(script.supportStatus).includes(search) ||
    normalizeSearch(script.recommendedFor).includes(search)
}

function formatScriptChoiceName(script) {
  const status = formatSupportStatus(script.supportStatus)
  const label = status ? `${script.name} - ${status}` : script.name
  return label.slice(0, 100)
}

function formatSupportStatus(status) {
  if (status === 'supported') return 'Supported'
  if (status === 'partial') return 'Partial support'
  if (status === 'planned') return 'Planned'
  return null
}

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
