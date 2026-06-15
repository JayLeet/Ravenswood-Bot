# Ravenswood Bot

Ravenswood Bot is a Discord bot for running Blood on the Clocktower games.

It handles the busy parts around a game: setup channels, player joins, role assignment, night guidance, nominations, voting, reminders, game-state tracking, and cleanup. The Storyteller is still in charge of the game. The bot is there to keep the table moving and reduce Discord admin work.

Community-made unofficial tool. Not affiliated with, endorsed by, sponsored by, or licensed by The Pandemonium Institute.

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
3. `/setup-channels` lets you pick existing channels instead, or create the missing ones from a picker.

If setup fails, fix the exact permission or role-order issue reported by the bot, then run `/setup-check` again.

The bot works best with Administrator while setting up a server. If you prefer fine-grained permissions, it needs enough access to create and edit channels, manage its game roles, move voice members, manage nicknames, read audit-log entries, send embeds, use application commands, manage messages, and use the voice permissions needed for table channels. Its bot role must be above the roles and channels it needs to manage.

## Common commands

- `/help` shows the in-Discord command guide.
- `/setup-check` checks setup readiness.
- `/setup` starts public or private server setup.
- `/setup-channels` opens the manual channel picker.
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

Required values:

- `DISCORD_TOKEN`: the bot token from the Discord Developer Portal.
- `CLIENT_ID`: the Discord application/client ID.

Public runtime package:

- `PUBLIC_RELEASE=true`: use this for the public runtime package.

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
