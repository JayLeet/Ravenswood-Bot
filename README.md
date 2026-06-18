# Ravenswood Bot

Ravenswood Bot is a Discord bot for running Blood on the Clocktower games.

It handles the busy parts around a game: setup channels, player joins, role assignment, night guidance, nominations, voting, reminders, game-state tracking, and cleanup. The Storyteller is still in charge of the game. The bot is there to keep the table moving and reduce Discord admin work.

Community-made unofficial tool. Not affiliated with, endorsed by, sponsored by, or licensed by The Pandemonium Institute.

## Invite Ravenswood Bot

[Add Ravenswood Bot to your Discord server](https://discord.com/oauth2/authorize?client_id=1516063372486119565&permissions=281855508213456&scope=bot%20applications.commands)

## What it does

- Creates and maintains the Discord channels used for a game.
- Supports public setup or private setup with a Blood on the Clocktower access role.
- Gives the Storyteller a dashboard for role setup, reminders, phase control, nominations, votes, deaths, and the Grimoire.
- Lets players join, spectate, request private voice chats, nominate, vote, and check their private Grimoire notes.
- Tracks substitutions, dead votes, night prompts, and end-game reveal flow.
- Posts update notices in the configured bot channel when a release needs attention.

Trouble Brewing is the main supported script. Bad Moon Rising and Sects & Violets may appear in the script data, but should be treated as partial support until they have been fully checked in live games.

## Server setup

Run these as a server administrator:

1. `/setup-check` checks whether the bot has the permissions and role position it needs.
2. `/setup` creates the Ravenswood Bluff category and the normal game channels.
3. `/setup-manual` lets you pick existing channels instead, or create the missing ones from a picker.

If setup fails, fix the exact permission or role-order issue reported by the bot, then run `/setup-check` again.

The bot role must be above every role it needs to create, assign, or edit. If Discord blocks setup even though the bot has the right permissions, check the bot role position first.

## Permissions

The invite link above asks for the permissions Ravenswood Bot currently uses:

- Manage Channels
- Manage Roles
- Manage Nicknames
- Manage Messages
- Move Members
- Mute Members
- View Audit Log
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Add Reactions
- Connect
- Speak
- Stream
- Create Public Threads
- Create Private Threads
- Send Messages in Threads
- Use Application Commands

Administrator also works, especially during setup, but it is not required if these permissions and the bot role order are correct.

## Common commands

- `/help` shows the in-Discord command guide.
- `/setup-check` checks setup readiness.
- `/setup` starts public or private server setup.
- `/setup-manual` opens the manual channel picker.
- `/create-game` creates a lobby and makes you the Storyteller.
- `/join` joins the current game or requests to join a live game.
- `/spectate` joins as a spectator.
- `/character` shows known character details.
- `/grimoire` opens player notes or spectator Grimoire access.
- `/nominate` nominates a player during the day.
- `/players` shows the current table.
- `/requests`, `/approve`, and `/reject` handle pending join and Grimoire requests.
- `/timer` starts a Storyteller day timer.
- `/end-game` opens the end-game flow.

Most live-game work happens from the game panel and Storyteller dashboard after setup.

## Running your own copy

Create a Discord application and bot in the Discord Developer Portal, then add a local `.env` file. The file is intentionally not committed.

In the bot settings, enable these privileged gateway intents:

- Server Members Intent: needed for setup, game roles, nicknames, and member recovery.
- Message Content Intent: needed for saved game logs to include chat transcripts from BOTC game channels.

The bot also uses the normal Guilds, Guild Messages, and Guild Voice States gateway intents. Those are requested by the code and do not need separate privileged-intent toggles in the Developer Portal. Presence Intent is not needed.

Required values:

- `DISCORD_TOKEN`: the bot token from the Discord Developer Portal.
- `CLIENT_ID`: the Discord application/client ID.

Install dependencies:

```bash
npm install
```

Deploy slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

Global slash commands can take time to appear in Discord. If commands look stale, wait a bit and check the server's Integrations command settings before redeploying.

## Notes for Storytellers

The bot tracks the game state it knows about, but Blood on the Clocktower still depends on Storyteller judgement. Poison, drunkenness, character ability timing, and unusual edge cases should be checked against the script and the actual table state before you confirm information to players.

If something looks wrong during a game, use the dashboard controls to correct the state before moving on.
