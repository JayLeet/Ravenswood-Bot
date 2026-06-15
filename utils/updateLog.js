const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_UPDATE_LOG_PATH = path.join(process.cwd(), 'BOTC_UPDATE_LOG.txt')
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

function loadBotUpdateLog(filePath = DEFAULT_UPDATE_LOG_PATH) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return parseBotUpdateLog(raw)
}

function parseBotUpdateLog(raw) {
  const text = String(raw || '')
  const currentVersion = getHeaderValue(text, 'Current version') || '0.0.0'
  const latestUpdateType = getHeaderValue(text, 'Latest update type') || 'none'
  const requiresSetup = parseYesNo(getHeaderValue(text, 'Requires /setup'))
  const latestEntry = parseLatestEntry(text)

  return {
    currentVersion,
    latestUpdateType,
    requiresSetup,
    latestEntry,
    validVersion: isValidVersion(currentVersion)
  }
}

function parseLatestEntry(text) {
  const entryText = String(text || '').split(/\nVersion:\s*/).slice(1)[0]
  if (!entryText) return null

  const latestEntryText = entryText.split(/\nVersion:\s*/)[0]
  const versionLine = latestEntryText.split('\n')[0]?.trim() || ''
  const body = `Version: ${versionLine}\n${latestEntryText}`
  const changes = parseChanges(body)

  return {
    version: versionLine,
    type: getHeaderValue(body, 'Type') || 'unknown',
    date: getHeaderValue(body, 'Date') || null,
    requiresSetup: parseYesNo(getHeaderValue(body, 'Requires /setup')),
    changes
  }
}

function parseChanges(text) {
  const [, section = ''] = String(text || '').split(/\nChanges:\s*\n/)
  return section
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
}

function getNextVersion(currentVersion, updateType) {
  const version = parseVersion(currentVersion)
  if (!version) return null

  const type = String(updateType || '').trim().toLowerCase()
  if (type === 'none') return formatVersion(version)
  if (type === 'minor') return formatVersion({ ...version, patch: version.patch + 1 })
  if (type === 'medium') return formatVersion({ ...version, minor: version.minor + 1, patch: 0 })
  if (type === 'big' || type === 'major' || type === 'huge') {
    return formatVersion({ major: version.major + 1, minor: 0, patch: 0 })
  }
  return null
}

function parseVersion(version) {
  const match = String(version || '').trim().match(VERSION_PATTERN)
  if (!match) return null
  const [, major, minor, patch] = match
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch)
  }
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`
}

function getHeaderValue(text, label) {
  const pattern = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'mi')
  return String(text || '').match(pattern)?.[1]?.trim() || null
}

function parseYesNo(value) {
  return String(value || '').trim().toLowerCase() === 'yes'
}

function isValidVersion(version) {
  return VERSION_PATTERN.test(String(version || '').trim())
}

function isInitialVersion(version) {
  return String(version || '').trim() === '0.0.0'
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  DEFAULT_UPDATE_LOG_PATH,
  getNextVersion,
  isInitialVersion,
  isValidVersion,
  loadBotUpdateLog,
  parseBotUpdateLog
}
