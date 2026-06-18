const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  formatCategory,
  getRoleDisplayName,
  truncate
} = require('./formatters')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  countDraftRoles,
  getDraftRoleIds,
  getRandomRoleTeamCount,
  getRandomRoleTeamLimit,
  isRandomRoleSelectionComplete,
  isRandomRoleTeamFull,
  RANDOM_ROLE_TEAMS
} = require('./randomRoleCounts')
const {
  createRandomRoleDistributionLines,
  formatTeamCountStatus
} = require('./randomRoleDistribution')
const {
  DRUNK_ROLE_ID,
  formatCounts,
  getBaseSetupCounts,
  hasDrunk,
  listAvailableSetupModifiers
} = require('../../systems/game/roles/setupCounts')

const MAX_SELECT_OPTIONS = 25
const DEFAULT_RANDOM_ROLE_TEAM = 'townsfolk'
const TEAM_BUTTON = {
  townsfolk: { style: ButtonStyle.Primary },
  outsider: { style: ButtonStyle.Primary },
  minion: { style: ButtonStyle.Danger },
  demon: { style: ButtonStyle.Danger }
}

function createRandomRolesPayload(view, draft = {}) {
  const playerCount = (view.users.players || []).length
  const scriptLikeView = getScriptLikeView(view)
  const baseCounts = getBaseSetupCounts(playerCount)
  const selectedCount = countDraftRoles(draft)
  const drunkSelected = isDrunkSelected(draft)
  const scriptHasDrunk = hasDrunk(scriptLikeView)
  const drunkShownName = draft.drunkShownRoleId
    ? getRoleDisplayName(view, draft.drunkShownRoleId)
    : 'Not chosen yet'
  const modifiers = listAvailableSetupModifiers(scriptLikeView)
  const selectedTeam = normalizeRandomRoleTeam(draft.selectedTeam)
  const teamLimit = getRandomRoleTeamLimit(playerCount, draft, selectedTeam)
  const selectedTeamCount = getRandomRoleTeamCount(draft, selectedTeam)
  const shouldShowDrunkSetupGuidance = scriptHasDrunk && (
    drunkSelected || !isRandomRoleTeamFull(playerCount, draft, 'outsider')
  )
  const distributionLines = createRandomRoleDistributionLines(playerCount, draft)

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('🎲 Randomize Roles')
        .setDescription([
          `Players joined: ${playerCount}`,
          `Real roles selected: ${selectedCount}/${playerCount}`,
          baseCounts ? `Base setup: ${formatCounts(baseCounts)}` : 'Base setup: unsupported player count',
          modifiers.length ? `Setup modifiers available: ${modifiers.join('; ')}` : null,
          drunkSelected ? `Drunk thinks they are: ${drunkShownName}` : null,
          drunkSelected ? 'This shown Townsfolk is not an extra real role.' : null,
          shouldShowDrunkSetupGuidance
            ? 'Setup Drunk here by selecting Drunk as the real Outsider, then choosing the Townsfolk they see.'
            : null,
          '',
          'Current setup counts:',
          ...distributionLines,
          '',
          `Showing: ${formatCategory(selectedTeam)} buttons (${selectedTeamCount}/${teamLimit ?? '?'})`,
          selectedTeamCount >= teamLimit && teamLimit !== null
            ? `${formatCategory(selectedTeam)} count reached. Unselect a chosen ${formatCategory(selectedTeam)} role before selecting a different one.`
            : 'Click role buttons to toggle them on or off, then press Confirm Random Roles.',
          selectedCount >= playerCount
            ? 'Overall required count reached. Unselect a chosen role before selecting a different one.'
            : null,
          '',
          drunkSelected
            ? 'After the game starts, move Drunk by selecting the Townsfolk player who should become Drunk and assigning them Drunk from Assign Role.'
            : null,
          drunkSelected
            ? 'The previous Drunk automatically becomes the Townsfolk they were shown as.'
            : null
        ].filter(Boolean).join('\n'))
        .setColor(0x9b59b6)
    ],
    components: [
      createRandomRoleTeamRow(selectedTeam),
      ...createRandomRoleButtonRows(view, selectedTeam, draft, playerCount),
      createRandomRolesButtonRow(drunkSelected, isRandomRoleSelectionComplete(playerCount, draft))
    ].slice(0, 5)
  }
}

function createRandomRolesDrunkShownPayload(view, draft = {}) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('🍻 Choose What Drunk Sees')
        .setDescription([
          'Choose the Townsfolk character the Drunk thinks they are.',
          'This is the token they see, not an extra real in-play role.',
          '',
          draft.drunkShownRoleId
            ? `Current choice: ${getRoleDisplayName(view, draft.drunkShownRoleId)}`
            : 'Current choice: Not chosen yet',
          '',
          'During a live game, move Drunk by assigning Drunk to the Townsfolk player who should become Drunk.'
        ].join('\n'))
        .setColor(0x9b59b6)
    ],
    components: [
      ...createRandomRoleDrunkShownRows(view, draft),
      new ActionRowBuilder().addComponents(
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.randomRolesBack)
          .setLabel('Back to Random Roles')
          .setStyle(ButtonStyle.Secondary), 'Back to Random Roles')
      )
    ].slice(0, 5)
  }
}

function createRandomRoleTeamRow(selectedTeam) {
  return new ActionRowBuilder().addComponents(
    RANDOM_ROLE_TEAMS.map(team => new ButtonBuilder()
      .setCustomId(createRandomRoleTeamButtonCustomId(team))
      .setLabel(formatCategory(team))
      .setStyle(team === selectedTeam ? ButtonStyle.Success : TEAM_BUTTON[team].style))
  )
}

function createRandomRoleButtonRows(view, team, draft = {}, playerCount = 0) {
  const selectedSet = new Set(draft[team] || [])
  const roles = (view.engine.roleCategories?.[team] || []).slice(0, 15)
  const teamFull = isRandomRoleTeamFull(playerCount, draft, team)
  const overallFull = countDraftRoles(draft) >= playerCount
  const rows = []
  for (let index = 0; index < roles.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      roles.slice(index, index + 5).map(roleId => createRandomRoleButton(view, team, roleId, selectedSet, teamFull, overallFull))
    ))
  }
  return rows
}

function createRandomRoleButton(view, team, roleId, selectedSet, teamFull, overallFull = false) {
  const selected = selectedSet.has(roleId)
  return new ButtonBuilder()
    .setCustomId(createRandomRoleToggleButtonCustomId(team, roleId))
    .setLabel(truncate(getRoleDisplayName(view, roleId), 80))
    .setDisabled((teamFull || overallFull) && !selected)
    .setStyle(selected ? ButtonStyle.Success : TEAM_BUTTON[team].style)
}

function createRandomRoleDrunkShownRows(view, draft = {}) {
  const options = createDrunkShownRoleOptions(view, getDraftRoleIds(draft)).slice(0, 15)
  const rows = []
  for (let index = 0; index < options.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      options.slice(index, index + 5).map(option => new ButtonBuilder()
        .setCustomId(createRandomRoleDrunkShownButtonCustomId(option.value))
        .setLabel(truncate(option.label, 80))
        .setStyle(option.value === draft.drunkShownRoleId ? ButtonStyle.Success : ButtonStyle.Primary))
    ))
  }
  return rows
}

function createRandomRolesButtonRow(drunkSelected, canConfirm = true) {
  const buttons = []
  if (drunkSelected) {
    buttons.push(applyButtonEmoji(new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShown)
      .setLabel('Choose What Drunk Sees')
      .setStyle(ButtonStyle.Primary), 'Choose What Drunk Sees'))
  }

  buttons.push(applyButtonEmoji(new ButtonBuilder()
    .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.randomRolesConfirm)
    .setLabel('Confirm Random Roles')
    .setDisabled(!canConfirm)
    .setStyle(canConfirm ? ButtonStyle.Success : ButtonStyle.Secondary), 'Confirm Random Roles'))

  return new ActionRowBuilder().addComponents(buttons)
}

function createDrunkShownRoleOptions(view, selectedRoleIds = []) {
  const selected = new Set(selectedRoleIds)
  return (view.engine.roleCategories?.townsfolk || [])
    .filter(roleId => !selected.has(roleId))
    .slice(0, MAX_SELECT_OPTIONS)
    .map(roleId => ({
      label: truncate(getRoleDisplayName(view, roleId), 100),
      value: roleId,
      description: 'The Townsfolk token the Drunk sees.'
    }))
}

function createRandomRoleTeamButtonCustomId(team) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect}:team:${team}`
}

function createRandomRoleToggleButtonCustomId(team, roleId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect}:toggle:${team}:${roleId}`
}

function createRandomRoleDrunkShownButtonCustomId(roleId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShownSelect}:${roleId}`
}

function normalizeRandomRoleTeam(team) {
  return RANDOM_ROLE_TEAMS.includes(team) ? team : DEFAULT_RANDOM_ROLE_TEAM
}

function isDrunkSelected(draft = {}) {
  return getDraftRoleIds(draft).includes(DRUNK_ROLE_ID)
}

function getScriptLikeView(view) {
  const roles = []
  for (const [team, roleIds] of Object.entries(view.engine.roleCategories || {})) {
    for (const roleId of roleIds || []) roles.push({ id: roleId, team })
  }
  return { roles }
}

module.exports = {
  DEFAULT_RANDOM_ROLE_TEAM,
  RANDOM_ROLE_TEAMS,
  countDraftRoles,
  createDrunkShownRoleOptions,
  createRandomRoleButton,
  createRandomRoleDistributionLines,
  createRandomRoleDrunkShownButtonCustomId,
  createRandomRoleTeamButtonCustomId,
  createRandomRoleToggleButtonCustomId,
  createRandomRolesDrunkShownPayload,
  createRandomRolesPayload,
  formatTeamCountStatus,
  getDraftRoleIds,
  getRandomRoleTeamCount,
  getRandomRoleTeamLimit,
  isDrunkSelected,
  isRandomRoleSelectionComplete,
  isRandomRoleTeamFull,
  normalizeRandomRoleTeam
}
