const VALID_GAME_STATES = Object.freeze(['lobby', 'in-game', 'ended'])

const GAME_ARRAY_FIELDS = Object.freeze([
  'alivePlayers',
  'chatMessages',
  'deadPlayers',
  'executionHistory',
  'messages',
  'nominations',
  'nominationRequests',
  'nightActions',
  'phaseHistory',
  'pendingNightDeaths',
  'reminders',
  'requests',
  'votes'
])

const GAME_OBJECT_FIELDS = Object.freeze([
  'deadVotes',
  'demonNotInPlayRoles',
  'executionShields',
  'lunaticInfo',
  'nightAreaSlots',
  'nightChannels',
  'nightCottageStatusMessages',
  'nightInfoPromptMessages',
  'nightInfoNoticeMessages',
  'nightOptions',
  'nightPromptMessages',
  'nightVoiceChannels',
  'pendingRoleInfoUpdates',
  'playerGrimoires',
  'playerMadeVoiceAccess',
  'playerMadeVoiceChannels',
  'publicDaySideChannelIds',
  'roleCategories',
  'roleHistory',
  'roleInfoPromptMessages',
  'roleInfoSent',
  'roles',
  'shownRoles',
  'statusEffects',
  'storytellerMoveRequests',
  'substituteBriefings',
  'users',
  'zombuulDeaths'
])

const GAME_NULLABLE_OBJECT_FIELDS = Object.freeze([
  'executionCandidate',
  'mastermindFinalDay',
  'paused',
  'pendingEndReveal',
  'pendingManualImpReplacement',
  'pendingWin',
  'replacementSlot'
])

const SERVER_CONFIG_ID_FIELDS = Object.freeze([
  'botUpdateChannelId',
  'botcAccessRoleId',
  'gameChannelId',
  'gameLogChannelId',
  'gamePanelMessageId',
  'liveChannelId',
  'playerGrimoireChannelId',
  'playerGrimoirePanelMessageId',
  'postGameChannelId',
  'spectatorChannelId',
  'storytellerChannelId',
  'storytellerDashboardMessageId',
  'storytellerDashboardStatusMessageId',
  'storytellerNightOrderGuidanceMessageId',
  'storytellerNominationDashboardMessageId',
  'waitingRoomVoiceChannelId'
])

const ACHIEVEMENT_NUMBER_FIELDS = Object.freeze([
  'deaths',
  'executionsSurvived',
  'gamesAsDemon',
  'gamesAsMinion',
  'gamesPlayed',
  'nominationsMade',
  'nominationsReceived',
  'updatedAt',
  'wins',
  'winsAsEvil',
  'winsAsGood'
])

const PENDING_SUMMARY_STATS_FIELDS = Object.freeze([
  'chatMessageCount',
  'executionCount',
  'nightActionCount',
  'nominationCount',
  'playerCount',
  'reminderCount',
  'spectatorCount'
])

module.exports = {
  ACHIEVEMENT_NUMBER_FIELDS,
  GAME_ARRAY_FIELDS,
  GAME_NULLABLE_OBJECT_FIELDS,
  GAME_OBJECT_FIELDS,
  PENDING_SUMMARY_STATS_FIELDS,
  SERVER_CONFIG_ID_FIELDS,
  VALID_GAME_STATES
}
