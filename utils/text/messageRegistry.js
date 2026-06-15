const fs = require('node:fs')
const path = require('node:path')
const { DEFAULT_MESSAGES } = require('./defaultMessages')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_OVERRIDE_PATH = path.join(PROJECT_ROOT, 'config', 'text-overrides.txt')

function createMessageRegistry(options = {}) {
  const defaults = options.defaults || DEFAULT_MESSAGES
  const overridePath = options.overridePath || DEFAULT_OVERRIDE_PATH
  const logger = options.logger || console
  const overrides = loadTextOverrides(overridePath, {
    defaults,
    logger
  })

  return {
    defaults,
    overrides,
    get(key, values = {}) {
      const template = Object.prototype.hasOwnProperty.call(overrides, key)
        ? overrides[key]
        : defaults[key]

      if (template === undefined) return key
      return applyPlaceholders(template, values)
    }
  }
}

function loadTextOverrides(filePath = DEFAULT_OVERRIDE_PATH, options = {}) {
  const defaults = options.defaults || DEFAULT_MESSAGES
  const logger = options.logger || console
  const overrides = {}

  if (!fs.existsSync(filePath)) return overrides

  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    logger.warn?.(`Could not read text override file: ${error.message}`)
    return overrides
  }

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      logger.warn?.(`Ignoring malformed text override on line ${index + 1}: ${rawLine}`)
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!key) {
      logger.warn?.(`Ignoring text override with empty key on line ${index + 1}.`)
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
      logger.warn?.(`Ignoring unknown text override key on line ${index + 1}: ${key}`)
      continue
    }

    overrides[key] = value
  }

  logger.info?.(`Loaded ${Object.keys(overrides).length} text override(s) from ${formatPath(filePath)}.`)
  return overrides
}

function applyPlaceholders(template, values = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match
    const value = values[key]
    return value === null || value === undefined ? '' : String(value)
  })
}

function formatPath(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replaceAll(path.sep, '/')
}

const messages = createMessageRegistry()

module.exports = {
  DEFAULT_OVERRIDE_PATH,
  applyPlaceholders,
  createMessageRegistry,
  loadTextOverrides,
  messages
}
