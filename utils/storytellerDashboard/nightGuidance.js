const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  createNightOrderCustomId
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  OPEN_STATUSES,
  createNightWakeEntries,
  formatSubmittedResponse,
  isResolvedFirstNightInfoAction
} = require('./nightGuidanceEntries')
const {
  createAlejoRulePromptLines,
  createAlejoRuleRows
} = require('./alejoRules')
const {
  createCurrentInstructionText
} = require('./nightGuidanceInstructions')
const {
  truncate
} = require('./formatters')

function createNightOrderGuidancePayload(view, playerLabels = {}, options = {}) {
  if (view.state !== 'in-game' || view.phase !== 'night') return null

  const entries = createNightWakeEntries(view, playerLabels)
  const started = options.started === true
  const currentIndex = normalizeCurrentIndex(options.index, entries)
  const current = started ? entries[currentIndex] || null : null

  const embed = new EmbedBuilder()
    .setTitle('Night Order Guidance')
    .setColor(0x34495e)
    .setDescription(createNightOrderDescription(view, entries, current, currentIndex, started))
    .setTimestamp()

  if (current) addCurrentPlayerFields(embed, current, view, entries, currentIndex)

  return {
    embeds: [embed],
    components: started ? [createProgressRow(view, currentIndex, entries.length)] : createStartRows(view)
  }
}

function createNightOrderDescription(view, entries, current, currentIndex, started) {
  const nightLabel = getNightLabel(view)
  if (!started) {
    return [
      `**🌙 ${nightLabel}**`,
      'Start the Night Order?',
      ...createAlejoRulePromptLines(view),
      '',
      isClocktowerLiveMode(view)
        ? 'This guide shows each assigned player, role, ability, and who is next. It does not send BOTC Bot night-action prompts in Clocktower.live mode.'
        : 'Use this to handle each character in order and send only the information their role should receive.'
    ].join('\n')
  }

  if (!current) {
    return [
      `**✅ ${nightLabel} complete**`,
      'No more players currently need night-order attention.',
      'Check any Storyteller-only exceptions, then advance to day when ready.'
    ].join('\n')
  }

  return [
    `**🌙 ${nightLabel}**`,
    `**👤 Current:** ${current.playerLabel} (${current.roleName})`,
    `**🔢 Order:** ${currentIndex + 1}/${entries.length}`,
    getNextEntryText(entries, currentIndex),
    isClocktowerLiveMode(view) ? null : formatActionStatus(current.action)
  ].filter(Boolean).join('\n')
}

function addCurrentPlayerFields(embed, current, view, entries, currentIndex) {
  if (isClocktowerLiveMode(view)) {
    embed.addFields({
      name: 'Ability',
      value: truncate(current.details || current.prompt || 'No ability text found.', 900),
      inline: false
    })
    return
  }

  addWarningField(embed, current)
  addReminderField(embed, current)
  embed.addFields({
    name: '📋 What to do',
    value: createCurrentInstructionText(current),
    inline: false
  })

  if (current.response) {
    embed.addFields({
      name: '💬 Submitted response',
      value: truncate(current.response, 900),
      inline: false
    })
  }

  if (current.details && current.details !== current.prompt) {
    embed.addFields({
      name: '📖 Role info',
      value: truncate(current.details, 900),
      inline: false
    })
  }
}

function addWarningField(embed, current) {
  const warnings = current.reminders?.warnings || []
  if (!warnings.length) return
  embed.addFields({
    name: '⚠️ Reminder warning',
    value: warnings.map(warning => `**${warning}**`).join('\n'),
    inline: false
  })
}

function addReminderField(embed, current) {
  const tokens = current.reminders?.tokens || []
  embed.addFields({
    name: '🏷️ Reminder tokens',
    value: tokens.length ? truncate(tokens.join('\n'), 900) : 'None',
    inline: false
  })
}

function createStartRows(view) {
  return [
    new ActionRowBuilder().addComponents(
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNightOrderCustomId('start', 0))
        .setLabel('Yes, start night order')
        .setStyle(ButtonStyle.Success), 'Yes, start night order'),
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createNightOrderCustomId('stop'))
        .setLabel('No')
        .setStyle(ButtonStyle.Danger), 'No')
    ),
    ...createAlejoRuleRows(view)
  ]
}

function createProgressRow(view, currentIndex, total) {
  const previousIndex = Math.max(0, currentIndex - 1)
  const nextIndex = Math.min(currentIndex + 1, Math.max(0, total))
  const stopLabel = isClocktowerLiveMode(view) ? 'Close' : 'Stop Night Order'
  const buttons = [
    createProgressButton('back', previousIndex, 'Back', currentIndex <= 0, ButtonStyle.Secondary)
  ]

  if (!isClocktowerLiveMode(view)) {
    buttons.push(createProgressButton('wake', currentIndex, 'Wake', currentIndex >= total, ButtonStyle.Success))
  }

  buttons.push(
    createProgressButton('next', nextIndex, 'Next Player', currentIndex + 1 >= total, ButtonStyle.Primary),
    createProgressButton('move', currentIndex, 'Move', currentIndex >= total, ButtonStyle.Secondary),
    createProgressButton('stop', null, stopLabel, false, ButtonStyle.Danger)
  )

  return new ActionRowBuilder().addComponents(buttons)
}

function createProgressButton(action, index, label, disabled, style) {
  return applyButtonEmoji(new ButtonBuilder()
    .setCustomId(createNightOrderCustomId(action, index))
    .setLabel(label)
    .setDisabled(disabled)
    .setStyle(style), label)
}

function getNightLabel(view) {
  return Number(view.day || 1) <= 1 ? 'First night' : `Night ${view.day}`
}

function normalizeCurrentIndex(index, entries) {
  const fallback = entries.findIndex(entry => OPEN_STATUSES.has(entry.action.status))
  const value = Number.isFinite(Number(index)) ? Number(index) : fallback
  if (!entries.length) return 0
  return Math.max(0, Math.min(value < 0 ? 0 : value, entries.length - 1))
}

function getNextEntryText(entries, currentIndex) {
  const next = entries[currentIndex + 1]
  return next ? `**➡️ Next:** ${next.playerLabel} (${next.roleName})` : '**➡️ Next:** none'
}

function formatActionStatus(action) {
  if (isResolvedFirstNightInfoAction(action)) return null
  if (action.status === 'submitted') return '**💬 Status:** Player replied. Review their response before moving on.'
  if (action.status === 'resolved') return '**✅ Status:** Resolved.'
  return '**🟢 Status:** Ready.'
}

module.exports = {
  createNightOrderGuidancePayload,
  createNightWakeEntries,
  formatSubmittedResponse,
  getNightLabel,
  normalizeCurrentIndex
}
