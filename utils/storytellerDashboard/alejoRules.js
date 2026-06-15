const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  shouldUseAlejoOrdering,
  scriptHasSnakeCharmer
} = require('../../systems/game/roles/FirstNightInfoRules')
const {
  createNightOrderCustomId
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  getScript
} = require('../../scripts')

function createAlejoRulePromptLines(view) {
  if (!shouldShowAlejoRuleChoice(view)) return []
  return [
    '',
    '**Alejo Rules**',
    'Snake Charmer may act before evil team info is delivered. Choose whether to use that ordering for this first night.'
  ]
}

function createAlejoRuleRows(view) {
  if (!shouldShowAlejoRuleChoice(view)) return []
  return [
    new ActionRowBuilder().addComponents(
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNightOrderCustomId('alejo-on'))
        .setLabel('Use Alejo Rules')
        .setStyle(ButtonStyle.Primary), 'Yes'),
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNightOrderCustomId('alejo-off'))
        .setLabel('No Alejo Rules')
        .setStyle(ButtonStyle.Secondary), 'No')
    )
  ]
}

function shouldShowAlejoRuleChoice(view) {
  if (Number(view?.day || 1) !== 1) return false
  const script = getScript(view?.scriptId)
  if (!scriptHasSnakeCharmer(script)) return false
  return view?.engine?.nightOptions?.alejoRules == null
}

function shouldUseAlejoRulesForView(view) {
  return shouldUseAlejoOrdering(view, getScript(view?.scriptId))
}

module.exports = {
  createAlejoRulePromptLines,
  createAlejoRuleRows
}
