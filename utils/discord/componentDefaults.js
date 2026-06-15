const Discord = require('discord.js')
const {
  resolveButtonEmoji
} = require('../buttonEmoji')

let applied = false

function applyComponentDefaults() {
  if (applied) return false
  applied = true

  const baseToJSON = Discord.ButtonBuilder.prototype.toJSON
  Discord.ButtonBuilder.prototype.toJSON = function toJSON(...args) {
    const data = baseToJSON.apply(this, args)
    if (!data.emoji) {
      const emoji = resolveButtonEmoji(data.label, data.custom_id)
      if (emoji) data.emoji = { name: emoji }
    }
    return data
  }

  return true
}

module.exports = {
  applyComponentDefaults
}
