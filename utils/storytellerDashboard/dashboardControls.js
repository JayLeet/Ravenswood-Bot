const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  hasCompleteAssignedRoles
} = require('../clocktowerLiveRoles')
const {
  createStorytellerAdvanceCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')

const RESUME_BUTTON_ID = 'botc:storyteller:resume'

function createMainButtonRow(view, controlsDisabled) {
  if (isClocktowerLiveMode(view)) return createClocktowerLiveButtonRow(view, controlsDisabled)

  const pendingRequests = Number(view.requests?.pending) || 0
  const paused = !!view.paused
  const components = [
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.refresh)
      .setEmoji('🔄')
      .setLabel('Refresh')
      .setDisabled(paused)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(createStorytellerAdvanceCustomId(view))
      .setLabel(view.state === 'lobby' ? 'Start Game' : 'Next Phase')
      .setDisabled(controlsDisabled || paused)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.requests)
      .setLabel(pendingRequests ? `(${pendingRequests}) Requests` : 'Requests')
      .setDisabled(controlsDisabled)
      .setStyle(pendingRequests ? ButtonStyle.Success : ButtonStyle.Secondary)
  ]

  if (paused) {
    components.push(new ButtonBuilder()
      .setCustomId(RESUME_BUTTON_ID)
      .setLabel('Resume')
      .setDisabled(controlsDisabled)
      .setStyle(ButtonStyle.Secondary))
  } else if (view.phase === 'day') {
    components.push(createGongButton(controlsDisabled))
  }

  components.push(createEndGameButton(controlsDisabled))

  applyButtonEmojis(components)
  return new ActionRowBuilder().addComponents(components)
}

function createClocktowerLiveButtonRow(view, controlsDisabled) {
  const paused = !!view.paused
  const components = [
    new ButtonBuilder()
      .setCustomId(createStorytellerAdvanceCustomId(view))
      .setLabel(getClocktowerLiveAdvanceLabel(view))
      .setDisabled(controlsDisabled || paused)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.playerControlPanel)
      .setLabel('Player Controls')
      .setDisabled(controlsDisabled || paused || !(view.users?.players || []).length)
      .setStyle(ButtonStyle.Secondary)
  ]

  if (view.phase === 'day' && !paused) {
    components.push(createTimerButton(controlsDisabled), createGongButton(controlsDisabled))
  }
  components.push(createEndGameButton(controlsDisabled))

  applyButtonEmojis(components)
  return new ActionRowBuilder().addComponents(components)
}

function createGongButton(controlsDisabled) {
  return new ButtonBuilder()
    .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.gong)
    .setLabel('Gong')
    .setDisabled(controlsDisabled)
    .setStyle(ButtonStyle.Primary)
}

function createTimerButton(controlsDisabled) {
  return new ButtonBuilder()
    .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.timer)
    .setLabel('Timer')
    .setDisabled(controlsDisabled)
    .setStyle(ButtonStyle.Secondary)
}

function createEndGameButton(controlsDisabled) {
  return new ButtonBuilder()
    .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.end)
    .setLabel('End Game')
    .setDisabled(controlsDisabled)
    .setStyle(ButtonStyle.Danger)
}

function getClocktowerLiveAdvanceLabel(view) {
  if (view.state === 'lobby') return 'Start Game'
  return view.phase === 'night' ? 'Day' : 'Night'
}

function createRoleButtons(view, controlsDisabled, randomRolesLocked, hasPlayers) {
  if (isClocktowerLiveMode(view)) {
    return createClocktowerLiveRoleButtons(view, controlsDisabled, randomRolesLocked, hasPlayers)
  }

  const paused = !!view.paused
  const externalMode = isClocktowerLiveMode(view)
  const buttons = [
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.grimoire)
      .setLabel('View Grimoire')
      .setDisabled(controlsDisabled || paused || !hasPlayers)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.playerControlPanel)
      .setLabel('Player Controls')
      .setDisabled(controlsDisabled || paused || !hasPlayers)
      .setStyle(ButtonStyle.Primary)
  ]

  if (shouldShowVotingHistoryButton(view)) {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.votingLogs)
      .setLabel('Voting History')
      .setDisabled(controlsDisabled || paused || externalMode)
      .setStyle(ButtonStyle.Secondary))
  }

  if (!paused && view.phase === 'day') buttons.push(createTimerButton(controlsDisabled))

  addNightOrRandomButtons(buttons, view, controlsDisabled, paused, randomRolesLocked)
  applyButtonEmojis(buttons)
  return buttons
}

function createClocktowerLiveRoleButtons(view, controlsDisabled, randomRolesLocked, hasPlayers) {
  const paused = !!view.paused
  const assigned = hasCompleteAssignedRoles(view)
  const buttons = [
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.rolePanel)
      .setLabel('Assign Roles')
      .setDisabled(controlsDisabled || paused || !hasPlayers)
      .setStyle(ButtonStyle.Secondary)
  ]

  if (view.state === 'lobby') {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.randomRoles)
      .setLabel('Randomize Roles')
      .setDisabled(randomRolesLocked || paused)
      .setStyle(ButtonStyle.Success))
  }

  if (view.phase === 'night' && assigned) {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.nightOrder)
      .setLabel('Night Order')
      .setDisabled(controlsDisabled || paused)
      .setStyle(ButtonStyle.Secondary))
  }

  if (assigned) {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.grimoire)
      .setLabel('View Grimoire')
      .setDisabled(controlsDisabled || paused || !hasPlayers)
      .setStyle(ButtonStyle.Secondary))
  }

  applyButtonEmojis(buttons)
  return buttons.slice(0, 5)
}

function addNightOrRandomButtons(buttons, view, controlsDisabled, paused, randomRolesLocked) {
  if (view.phase === 'night') {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.move)
      .setLabel('Move')
      .setDisabled(controlsDisabled || paused)
      .setStyle(ButtonStyle.Secondary))
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.nightOrder)
      .setLabel('Night Order')
      .setDisabled(controlsDisabled || paused)
      .setStyle(ButtonStyle.Secondary))
  } else if (buttons.length < 5) {
    buttons.push(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.randomRoles)
      .setLabel('Randomize Roles')
      .setDisabled(randomRolesLocked || paused)
      .setStyle(ButtonStyle.Success))
  }
}

function applyButtonEmojis(buttons) {
  for (const button of buttons) applyButtonEmoji(button, button.data?.label)
}

function shouldShowVotingHistoryButton(view) {
  const nominationCount = view.counts?.nominations || view.engine?.nominations?.length || 0
  return view.phase !== 'nominations' && view.phase !== 'night' && nominationCount > 0
}

module.exports = {
  RESUME_BUTTON_ID,
  createMainButtonRow,
  createRoleButtons,
  isClocktowerOnlineMode: isClocktowerLiveMode,
  shouldShowVotingHistoryButton
}
