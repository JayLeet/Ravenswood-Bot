module.exports = {
  ...require('../achievementStatsStore'),
  ...require('../createGameCooldownStore'),
  ...require('../database'),
  ...require('../gameStore'),
  ...require('../pendingGameSummaryStore'),
  ...require('../serverConfigStore')
}