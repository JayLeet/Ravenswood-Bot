const {
  EmbedBuilder
} = require('discord.js')
const {
  logSetupRecoverable
} = require('./setupLogging')

const SETUP_PROGRESS_STEPS = Object.freeze([
  { key: 'safety', label: 'Checked setup role safety' },
  { key: 'channels', label: 'Created or reused setup channels' },
  { key: 'validation', label: 'Checked channel permissions' },
  { key: 'roles', label: 'Prepared BOTC roles' },
  { key: 'panel', label: 'Posted the game panel' },
  { key: 'support', label: 'Prepared support channels, voice, and cottages' },
  { key: 'access', label: 'Applied setup access permissions' },
  { key: 'save', label: 'Saved server setup' }
])

function createSetupProgressPayload(completed = [], options = {}) {
  const completedSet = new Set(completed)
  const description = [
    'Setup is running. I will update this message as each step finishes.',
    '',
    ...SETUP_PROGRESS_STEPS.map(step => formatSetupProgressStep(step, completedSet))
  ].join('\n')

  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setTitle(options.title || 'Setting up the bot...')
        .setDescription(description)
        .setColor(options.color || 0xf1c40f)
        .setTimestamp()
    ],
    components: []
  }
}

function formatSetupProgressStep(step, completedSet) {
  return `${completedSet.has(step.key) ? '✅' : '❌'} ${step.label}`
}

async function notifySetupProgress(options = {}, completedKey) {
  if (typeof options.onProgress !== 'function') return null
  options.completedSetupSteps ??= []
  if (completedKey && !options.completedSetupSteps.includes(completedKey)) {
    options.completedSetupSteps.push(completedKey)
  }
  return options.onProgress([...options.completedSetupSteps]).catch(err => logSetupRecoverable('update-setup-progress', err, {
    completedKey,
    completedSteps: options.completedSetupSteps.join(',')
  }))
}

module.exports = {
  createSetupProgressPayload,
  notifySetupProgress
}
