const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createGrimoireCustomId
} = require('../../embeds')

function createImpReplacementChoicePayload(view, replacement, labels = {}) {
  const pending = replacement.pendingReplacement || view?.pendingManualImpReplacement || {}
  const candidates = replacement.candidates || pending.candidates || []
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Choose the new Imp')
      .setDescription([
        'The Imp died and a living Minion must become the new Imp.',
        'Choose which Minion becomes the Imp. Scarlet Woman is automatic only when alive, sober, healthy, and the Scarlet Woman condition applies.'
      ].join('\n'))
      .setColor(0xe74c3c)
      .setTimestamp()],
    components: createImpReplacementRows(candidates, pending.id, labels)
  }
}

function createImpReplacementRows(candidates, requestId, labels = {}) {
  const buttons = candidates.slice(0, 20).map(playerId => new ButtonBuilder()
    .setCustomId(createGrimoireCustomId('imp-replace', playerId, requestId))
    .setLabel(labels[playerId] || `Player ${String(playerId).slice(-4)}`)
    .setStyle(ButtonStyle.Danger))
  const rows = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)))
  }
  return rows
}

module.exports = {
  createImpReplacementChoicePayload,
  createImpReplacementRows
}
