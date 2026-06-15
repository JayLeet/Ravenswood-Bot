const { REST, Routes } = require('discord.js')
const fs = require('node:fs')
const path = require('node:path')
require('dotenv').config({ quiet: true })

const {
  shouldOmitDefaultMemberPermissions
} = require('./utils/commandAccess')

async function main() {
  try {
    validateEnvironment(process.env)
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)
    const commands = loadCommandPayloads(path.join(__dirname, 'commands'))

    console.log(`Deploying ${commands.length} global slash command(s)...`)
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
    console.log('Successfully deployed global commands.')
    console.log('Global command updates can take a while to appear in every server.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}

function loadCommandPayloads(commandsPath) {
  return fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b))
    .map(file => require(path.join(commandsPath, file)))
    .map(command => createCommandPayload(command.data || command))
    .filter(command => command.name)
}

function createCommandPayload(slashCommand) {
  const payload = {
    name: slashCommand.name,
    description: slashCommand.description || 'No description provided',
    options: slashCommand.options || []
  }
  if (!shouldOmitDefaultMemberPermissions(slashCommand)) {
    payload.default_member_permissions = slashCommand.default_member_permissions
  }
  return payload
}

function validateEnvironment(env) {
  const missing = ['DISCORD_TOKEN', 'CLIENT_ID'].filter(name => !env[name])
  if (!missing.length) return

  console.error(`Missing required environment variable(s): ${missing.join(', ')}`)
  console.error('Create a local .env file with DISCORD_TOKEN and CLIENT_ID before deploying commands.')
  process.exit(1)
}

if (require.main === module) main()

module.exports = {
  createCommandPayload,
  loadCommandPayloads,
  validateEnvironment
}
