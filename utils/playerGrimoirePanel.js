const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  PLAYER_GRIMOIRE_ACTIONS
} = require('./playerGrimoire')
const {
  applyButtonEmoji
} = require('./buttonEmoji')

function createPlayerGrimoirePanelPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('Your Grimoire')
        .setDescription('Open your private player grimoire to track role guesses, reminder tokens, and personal notes.')
        .setColor(0x8e44ad)
    ],
    components: [
      new ActionRowBuilder().addComponents(createOpenPlayerGrimoireButton())
    ]
  }
}

function createOpenPlayerGrimoireButton() {
  return applyButtonEmoji(new ButtonBuilder()
    .setCustomId(PLAYER_GRIMOIRE_ACTIONS.open)
    .setLabel('Open Your Grimoire')
    .setStyle(ButtonStyle.Primary), 'Your Grimoire')
}

module.exports = {
  createOpenPlayerGrimoireButton,
  createPlayerGrimoirePanelPayload
}
