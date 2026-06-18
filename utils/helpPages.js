const HELP_PAGE_KEY = Object.freeze({
  overview: 'overview',
  setup: 'setup',
  player: 'player',
  spectator: 'spectator',
  storyteller: 'storyteller',
  admin: 'admin'
})

const HELP_PAGES = Object.freeze([
  {
    key: HELP_PAGE_KEY.overview,
    title: '🎭 BOTC Bot Help',
    description: [
      'Choose the page that matches what you need.'
    ],
    fields: [
      helpField('⚙️ Setup and Lobby', 'Setup commands, cleanup tools, update-channel settings, lobby creation, scripts, and start-game commands.'),
      helpField('👥 Player Commands', 'Character lookup, private Grimoire notes, nominations, player lists, status, and private voice.'),
      helpField('👁️ Spectator Commands', 'Character lookup, table status, spectator tools, Grimoire access, joining games, and taking an empty Storyteller seat.'),
      helpField('👑 Storyteller Commands', 'Request handling, end-game flow, phase changes, request lists, resume, and timers.'),
      helpField('🛡️ Admin and Testing', 'Force-end tools, participant removal, and playtest-server test games.')
    ]
  },
  {
    key: HELP_PAGE_KEY.setup,
    title: '⚙️ Setup and Lobby',
    description: [
      'Admin tools for server setup, cleanup, and lobby creation.'
    ],
    fields: [
      helpField('🛠️ `/setup`', 'Guided setup for most servers.', 'Checks permissions, previews changes, then asks for final confirmation.'),
      helpField('🩺 `/setup-check`', 'Checks whether setup can run.', 'Use this before setup when a server has strict role or channel permissions.'),
      helpField('🧩 `/setup-manual`', 'Manual setup for existing servers.', 'Pick a category, Waiting Room, game-log archive, and save behavior.'),
      helpField('🧹 `/delete`', 'Removes BOTC-managed setup areas.', 'User-created channels and categories are left alone.'),
      helpField('📣 `/bot-update-channel set/show/clear`', 'Controls where bot update notices go.', 'Admins can choose, view, or clear the saved update channel.'),
      helpField('👑 `/create-game`', 'Creates a new lobby.', 'The user who creates it becomes the Storyteller.'),
      helpField('📜 `/script`', 'Shows the current script privately.', 'Storytellers can change it before the game starts.'),
      helpField('▶️ `/start`', 'Starts the game.', 'Storyteller-only. Use it after roles and players are ready.')
    ]
  },
  {
    key: HELP_PAGE_KEY.player,
    title: '👥 Player Commands',
    description: [
      'Commands active players may need during a game.'
    ],
    fields: [
      helpField('🔎 `/character role:<character>`', 'Looks up a character.', 'Shows team, ability, wake timing, and notes when known.'),
      helpField('🔮 `/grimoire`', 'Opens your private Grimoire view.', 'Use it for your notes and seating information.'),
      helpField('📨 `/invite player:<player>`', 'Invites a player into your private voice room.', 'Use this after you are already inside a bot-made room.'),
      helpField('🏃 `/leave`', 'Leaves the active game.', 'Available only when the current game state allows leaving.'),
      helpField('🗣️ `/nominate player:<player>`', 'Nominates a player.', 'Living players can nominate when nominations are open.'),
      helpField('👥 `/players`', 'Shows the player list.', 'Includes spectators, the Storyteller, deaths, and ghost-vote status.'),
      helpField('📊 `/status`', 'Shows the current game state.', 'Includes phase, day, player count, and vote state.'),
      helpField('🔒 `/voicechat player:<player>`', 'Requests a private day voice chat.', 'Use during day or nominations.')
    ]
  },
  {
    key: HELP_PAGE_KEY.spectator,
    title: '👁️ Spectator Commands',
    description: [
      'Commands spectators and waiting users may need.'
    ],
    fields: [
      helpField('🔎 `/character role:<character>`', 'Looks up a character.', 'Shows team, ability, wake timing, and notes when known.'),
      helpField('🔮 `/grimoire`', 'Requests Grimoire access, or opens it after approval.', 'Use this when watching with Storyteller-approved access.'),
      helpField('👑 `/become-storyteller`', 'Takes an empty Storyteller seat.', 'Works when no Storyteller is active and you are not a player.'),
      helpField('🚪 `/join`', 'Asks to join as a player.', 'During an active game, the Storyteller reviews the request.'),
      helpField('🏃 `/leave`', 'Leaves the active game.', 'Available only when the current game state allows leaving.'),
      helpField('👥 `/players`', 'Shows the player list.', 'Includes spectators, the Storyteller, deaths, and ghost-vote status.'),
      helpField('👁️ `/spectate`', 'Joins as a spectator.', 'Works instantly if you are not already in the game.'),
      helpField('📊 `/status`', 'Shows the current game state.', 'Includes phase, day, player count, and vote state.')
    ]
  },
  {
    key: HELP_PAGE_KEY.storyteller,
    title: '👑 Storyteller Commands',
    description: [
      'Most Storyteller work happens from the dashboard. These commands stay available.'
    ],
    fields: [
      helpField('✅ `/approve player:<player>`', 'Approves a pending request.', 'Covers join requests and Grimoire access requests.'),
      helpField('❌ `/reject player:<player>`', 'Rejects a pending request.', 'Covers join requests and Grimoire access requests.'),
      helpField('🏁 `/end-game`', 'Opens the end-game reveal flow.', 'Also ends an empty lobby when no game has started.'),
      helpField('⏭️ `/next-phase`', 'Moves to the next phase.', 'Use the dashboard when possible; this command is the direct shortcut.'),
      helpField('📬 `/requests`', 'Shows pending requests.', 'Includes approve and reject buttons.'),
      helpField('▶️ `/resume`', 'Resumes a paused substitution game.', 'Use when the Storyteller wants to continue without a replacement.'),
      helpField('⏲️ `/timer minutes:<1-10>`', 'Starts a day timer.', 'The bot sounds the Gong when it ends.')
    ]
  },
  {
    key: HELP_PAGE_KEY.admin,
    title: '🛡️ Admin and Testing',
    description: [
      'Restricted commands for cleanup, moderation, and playtesting.'
    ],
    fields: [
      helpField('🛑 `/admin end-game reason:<reason>`', 'Force-ends the active game.', 'Admin-only. Cleans game roles, channels, panels, and voice state.'),
      helpField('👢 `/admin kick user:<user>`', 'Removes a participant.', 'Admin-only. Keeps the game running when possible.'),
    ]
  }
])

const HELP_PAGE_INDEX = Object.freeze(Object.fromEntries(
  HELP_PAGES.map((page, index) => [page.key, index])
))

const IN_GAME_HELP_PAGE = Object.freeze({
  title: '🎮 In-Game Help',
  description: [
    'Player commands you may need while a game is running.'
  ],
  fields: [
    helpField('📊 `/status`', 'Shows the current phase.', 'Includes day, player count, and vote state.'),
    helpField('👥 `/players`', 'Lists the table.', 'Includes players, spectators, deaths, and ghost-vote status.'),
    helpField('🔎 `/character role:<character>`', 'Looks up a character.', 'Shows ability text and wake notes.'),
    helpField('🔮 `/grimoire`', 'Opens your private Grimoire view.', 'Use it for your notes and seating information.'),
    helpField('🗣️ `/nominate player:<player>`', 'Nominates during nominations.', 'Living players only.'),
    helpField('🔒 `/voicechat player:<player>`', 'Requests a private day voice chat.', 'Use during day or nominations.'),
    helpField('📨 `/invite player:<player>`', 'Invites someone into your private voice room.', 'Works after you are already inside a bot-made room.'),
    helpField('🚪 `/leave`', 'Leaves the game.', 'Available only when the current game state allows leaving.')
  ]
})

function helpField(name, summary, detail = null) {
  return {
    name,
    value: detail ? `${summary}\n${detail}` : summary
  }
}

function getHelpPage(index = 0) {
  const pageIndex = clampPageIndex(index)
  return {
    ...HELP_PAGES[pageIndex],
    index: pageIndex,
    total: HELP_PAGES.length
  }
}

function getInGameHelpPage() {
  return {
    ...IN_GAME_HELP_PAGE,
    index: 0,
    total: 1
  }
}

function clampPageIndex(index) {
  const number = Number.parseInt(index, 10)
  if (!Number.isFinite(number) || number < 0) return 0
  if (number >= HELP_PAGES.length) return HELP_PAGES.length - 1
  return number
}

module.exports = {
  HELP_PAGE_INDEX,
  HELP_PAGE_KEY,
  HELP_PAGES,
  clampPageIndex,
  getInGameHelpPage,
  getHelpPage
}
