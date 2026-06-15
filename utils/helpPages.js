const HELP_PAGES = Object.freeze([
  {
    title: 'BOTC Bot Help - Getting Started',
    description: [
      'Use this bot to help run Blood on the Clocktower games in Discord.',
      '',
      '**Basic flow:**',
      '1. Admins open setup and choose Public setup or Private with BOTC role.',
      '2. The Storyteller creates a game lobby from the game panel.',
      '3. Players join before the game starts. Spectators can spectate instantly.',
      '4. The Storyteller chooses a script and assigns roles with dashboard buttons.',
      '5. The Storyteller starts the game and uses the dashboard to manage play.'
    ]
  },
  {
    title: 'BOTC Bot Help - Setup and Lobby',
    description: [
      '`/setup` - Server-admin only, with bot owner override. Opens setup visibility buttons for public setup or private setup with the BOTC access role.',
      '`/setup-check` - Server-admin only, with bot owner override. Checks whether setup permissions and roles look ready before running setup.',
      '`/setup-channels` - Server-admin only, with bot owner override. Opens a picker to choose existing setup channels or create missing manual channels.',
      '`/bot-update-channel set/show/clear` - Server-admin only, with bot owner override. Configure where BOTC Bot update embeds are posted.',
      '`/create-game` - Creates a new game. You become the Storyteller.',
      '`/script` - Privately shows the current script and characters. Storytellers can use `name` before the game starts to change it.',
      '`/start` - Storyteller-only. Starts the game.',
      'Automatic setup prepares the Waiting Room voice channel and shared BOTC voice spaces.'
    ]
  },
  {
    title: 'BOTC Bot Help - Player Commands',
    description: [
      '`/character role:<character>` - Shows character team, ability, wake timing, and notes when known.',
      '`/grimoire` - Players open private role guesses and notes; spectators request or view approved grimoire access.',
      '`/invite player:<player>` - Invites another player into your current private voice room.',
      '`/join` - Joins before the game starts, or sends a join request during a live game.',
      '`/leave` - Leaves the active game when possible. During a paused game, players and the Storyteller can still leave.',
      '`/nominate player:<player>` - Living player-only. Nominate once nominations are open.',
      '`/players` - Lists players, spectators, the Storyteller, and dead-vote availability.',
      '`/spectate` - Instantly joins as a spectator if you are not already in the current game.',
      '`/status` - Shows the current game status.',
      '`/voicechat player:<player>` - Requests a private day voice chat with another player.'
    ]
  },
  {
    title: 'BOTC Bot Help - Storyteller Commands',
    description: [
      '`/approve player:<player>` - Approves the selected player\'s pending join or grimoire request.',
      '`/become-storyteller` - Takes the Storyteller seat when there is no active Storyteller. Current players cannot become the new Storyteller; spectators can.',
      '`/end-game` - Storyteller-only. Opens the end-game reveal flow, or ends an empty lobby.',
      '`/next-phase` - Storyteller-only. Advances the game to the next phase.',
      '`/reject player:<player>` - Rejects the selected player\'s pending join or grimoire request.',
      '`/requests` - Shows pending join and grimoire requests with approve/reject buttons.',
      '`/resume` - Storyteller-only. Resumes a paused substitution game without waiting for a replacement.',
      '`/timer minutes:<1-10>` - Storyteller-only. Starts a day timer that sounds the Gong when it ends.'
    ]
  },
  {
    title: 'BOTC Bot Help - Admin and Testing',
    description: [
      '`/admin end-game reason:<reason>` - Server-admin only, with bot owner override. Forcefully ends and cleans up the active game.',
      '`/admin kick user:<user>` - Server-admin only, with bot owner override. Removes a participant without ending the game.',
      '`/dev` - Bot owner only. Toggles temporary developer channel visibility and message access for yourself.',
    ]
  },
  {
    title: 'BOTC Bot Help - Live Game Notes',
    description: [
      'Dead players get one tracked ghost vote.',
      'Nominations and votes are handled through player commands and Storyteller dashboard controls. Current nominations also appear in the Storyteller dashboard channel.',
      'View Grimoire opens the full Grimoire immediately, with player buttons below it.',
      'Night phase permissions and private night areas are managed automatically where possible.',
      'The Storyteller is always the final authority and can use dashboard overrides when needed.',
      'Trouble Brewing is the main supported script. Bad Moon Rising and Sects & Violets are partial support for now.'
    ]
  }
])

function getHelpPage(index = 0) {
  const pageIndex = clampPageIndex(index)
  return {
    ...HELP_PAGES[pageIndex],
    index: pageIndex,
    total: HELP_PAGES.length
  }
}

function clampPageIndex(index) {
  const number = Number.parseInt(index, 10)
  if (!Number.isFinite(number) || number < 0) return 0
  if (number >= HELP_PAGES.length) return HELP_PAGES.length - 1
  return number
}

module.exports = {
  HELP_PAGES,
  clampPageIndex,
  getHelpPage
}
