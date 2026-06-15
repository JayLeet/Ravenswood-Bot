require('dotenv').config({ quiet: true })

const {
  Client,
  GatewayIntentBits
} = require('discord.js')

const {
  loadGames,
  loadServerConfigs
} = require('./systems/persistence')
const {
  createRuntimeSystems
} = require('./systems/startup/runtimeSystems')
const {
  runStartupSelfCheck
} = require('./systems/startup/startupSelfCheck')
const {
  startDiscordApiMetricsReporter
} = require('./utils/discord/apiMetrics')
const {
  applyComponentDefaults
} = require('./utils/discord/componentDefaults')
const {
  beginStartupOutput,
  installClientDiagnostics,
  installProcessDiagnostics,
  loginWithDiagnostics,
  logStartupStep,
  startRuntimeHealthReporter
} = require('./utils/startupDiagnostics')

const startupOutput = beginStartupOutput()

main(startupOutput).catch(err => {
  startupOutput.fail(err)
  process.exit(1)
})

async function main(startupOutput) {
  installProcessDiagnostics(process, startupOutput.logger)
  applyComponentDefaults()
  logStartupStep('Booting BOTC Bot...', startupOutput.logger)

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates
    ]
  })
  installClientDiagnostics(client, startupOutput.logger)
  startDiscordApiMetricsReporter({ intervalMs: process.env.DISCORD_API_METRICS_INTERVAL_MS })
  startRuntimeHealthReporter({ logger: startupOutput.logger })

  logStartupStep('Running startup self-check...', startupOutput.logger)
  const selfCheck = await runStartupSelfCheck()
  logStartupStep(
    selfCheck.skipped ? 'Startup self-check skipped.' : 'Startup self-check passed.',
    startupOutput.logger
  )

  logStartupStep('Loading persisted state...', startupOutput.logger)
  const runtime = createRuntimeSystems({
    client,
    games: loadGames(),
    serverConfigs: loadServerConfigs()
  })

  client.once('clientReady', () => {
    Promise.resolve(runtime.handleClientReady())
      .then(() => {
        const tag = client.user?.tag ? ` as ${client.user.tag}` : ''
        startupOutput.succeed(`Ready${tag}.`)
      })
      .catch(err => {
        startupOutput.fail(err, '[BOTC][Startup] Startup failed after Discord ready')
        process.exit(1)
      })
  })
  client.on('guildCreate', runtime.handleGuildCreate)
  client.on('interactionCreate', runtime.handleInteraction)

  const tokenKey = ['DISCORD', 'TOKEN'].join('_')
  await loginWithDiagnostics(client, process.env[tokenKey], startupOutput.logger)
}
