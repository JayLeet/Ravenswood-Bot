const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js')
const {
  DASHBOARD_TEXT_INPUT_ID,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')

function createReminderModal() {
  return createDashboardTextModal(
    STORYTELLER_DASHBOARD_ACTIONS.reminderModal,
    'Add Reminder',
    'Reminder text',
    'Example: Fortune Teller red herring'
  )
}

function createSecretInfoModal(defaultText = '') {
  return createDashboardTextModal(
    STORYTELLER_DASHBOARD_ACTIONS.secretModal,
    'Send Secret Info',
    'Message to send',
    'Write the private info this player should receive.',
    defaultText
  )
}

function createTimerModal(defaultValue = '5') {
  return createDashboardTextModal(
    STORYTELLER_DASHBOARD_ACTIONS.timerModal,
    'Start Timer',
    'Minutes',
    '1 to 10, example: 5',
    defaultValue,
    TextInputStyle.Short,
    2
  )
}

function createVoteClockhandSpeedModal(defaultValue = '') {
  return createDashboardTextModal(
    STORYTELLER_DASHBOARD_ACTIONS.voteClockhandSpeedModal,
    'Set Clockhand Speed',
    'Seconds per voter',
    '0.5 to 3, example: 1.5',
    defaultValue,
    TextInputStyle.Short,
    4
  )
}

function createVoteThresholdModal(defaultValue = '') {
  return createDashboardTextModal(
    STORYTELLER_DASHBOARD_ACTIONS.voteThresholdModal,
    'Set Vote Threshold',
    'Votes needed for majority',
    'Example: 4',
    defaultValue,
    TextInputStyle.Short,
    3
  )
}

function createDashboardTextModal(
  customId,
  title,
  label,
  placeholder,
  defaultText = '',
  style = TextInputStyle.Paragraph,
  maxLength = 1000
) {
  const input = new TextInputBuilder()
    .setCustomId(DASHBOARD_TEXT_INPUT_ID)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setRequired(true)
    .setMaxLength(maxLength)
    .setStyle(style)

  if (defaultText) input.setValue(String(defaultText).slice(0, maxLength))

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(input)
    )
}

module.exports = {
  createReminderModal,
  createSecretInfoModal,
  createTimerModal,
  createVoteClockhandSpeedModal,
  createVoteThresholdModal
}
