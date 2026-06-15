const {
  ActionRowBuilder,
  ButtonBuilder
} = require('discord.js')

function createButtonRows(buttons) {
  const rows = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5).map(button => new ButtonBuilder()
      .setCustomId(button.customId)
      .setLabel(button.label)
      .setStyle(button.style))))
  }
  return rows.slice(0, 3)
}

function addDraftField(embed, draft = []) {
  if (!draft.length) return embed
  embed.addFields({
    name: 'Queued responses',
    value: truncate(draft.map((item, index) => `${index + 1}. ${item.label || item.text}`).join('\n'), 900),
    inline: false
  })
  return embed
}

function truncate(value, maxLength) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

module.exports = {
  addDraftField,
  createButtonRows,
  truncate
}
