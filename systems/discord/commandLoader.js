const fs = require('node:fs')
const path = require('node:path')
const {
  Collection
} = require('discord.js')
const {
  createBotLogger
} = require('../../utils/logger')

const log = createBotLogger({ subsystem: 'CommandLoader' })

function loadCommands(client, commandsDir) {
  if (!commandsDir || typeof commandsDir !== 'string') {
    throw new TypeError('Missing commands directory path.')
  }

  client.commands = new Collection()

  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b))

  for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file))
    const commandName = command.name || command.data?.name

    if (!commandName || typeof command.execute !== 'function') {
      log.warn('skip-invalid-command-module', 'Skipping invalid command module.', { file })
      continue
    }

    client.commands.set(commandName, command)
    log.info('load-command', 'Loaded command.', { command: commandName })
  }

  return client.commands
}

module.exports = {
  loadCommands
}
