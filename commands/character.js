const { ApplicationCommandOptionType } = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  respondAutocomplete
} = require('../systems/discord/interactions/feedback')
const {
  formatCharacterHelp
} = require('../utils/characterHelp')

const MAX_AUTOCOMPLETE_CHOICES = 25

module.exports = {
  name: 'character',
  description: 'Show what a character does.',
  options: [
    {
      name: 'role',
      description: 'Start typing a character name.',
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true
    }
  ],
  data: {
    name: 'character',
    description: 'Show what a character does.',
    options: [
      {
        name: 'role',
        description: 'Start typing a character name.',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true
      }
    ]
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const query = interaction.options.getString('role', true)
    const scriptId = getCurrentScriptId(interaction, gameLifecycle)
    const role = gameLifecycle.scripts.findRole(scriptId, query)

    if (!role) {
      return gameLifecycle.createError(
        gameLifecycle.errorTypes.NOT_FOUND,
        `I could not find "${query}" on the current script.`
      )
    }

    return {
      ok: true,
      title: 'Character information',
      message: formatCharacterHelp(role)
    }
  }, { ephemeral: true }),

  async autocomplete(interaction, { gameLifecycle }) {
    const focused = interaction.options.getFocused() || ''
    const scriptId = getCurrentScriptId(interaction, gameLifecycle)
    const choices = getCharacterAutocompleteChoices(gameLifecycle.scripts, scriptId, focused)

    return respondAutocomplete(interaction, choices)
  },

  getCharacterAutocompleteChoices
}

function getCurrentScriptId(interaction, gameLifecycle) {
  const game = interaction.guild?.id
    ? gameLifecycle.get(interaction.guild.id)
    : null

  return game?.scriptId || gameLifecycle.scripts.defaultScriptId
}

function getCharacterAutocompleteChoices(scriptService, scriptId, query = '') {
  const script = scriptService.getScript(scriptId) || scriptService.getDefaultScript()
  const search = normalizeSearch(query)

  return script.roles
    .filter(role => matchesRole(role, search))
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
    .map(role => ({
      name: `${role.name} (${formatTeam(role.team)})`.slice(0, 100),
      value: role.id
    }))
}

function matchesRole(role, search) {
  if (!search) return true

  return normalizeSearch(role.name).includes(search) ||
    normalizeSearch(role.id).includes(search) ||
    normalizeSearch(role.team).includes(search)
}

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function formatTeam(team) {
  return String(team || 'unknown')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}