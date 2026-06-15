const {
  ChannelType
} = require('discord.js')
const {
  queuedVoiceMove
} = require('../../../utils/discord/voiceActions')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  WAITING_ROOM_VOICE_CHANNEL_NAME
} = require('../../../utils/setupVoiceChannels')

const log = createBotLogger({ subsystem: 'PostGameVoiceCleanup' })

const GAME_VOICE_CATEGORY_NAMES = Object.freeze([
  'Ravenswood Bluff',
  'Ravenswood Bluff Cottages'
])

async function cleanupEndedGameVoiceAndRoles(guild, gameManager) {
  const summary = createPostGameVoiceCleanupSummary()
  if (!guild || !gameManager) return summary

  await refreshPostGameVoiceChannels(guild)
  const channels = getCachedValues(guild.channels?.cache)
  const categoryIds = new Set(channels
    .filter(channel => channel.type === ChannelType.GuildCategory)
    .filter(channel => GAME_VOICE_CATEGORY_NAMES.includes(channel.name))
    .map(channel => channel.id))

  if (!categoryIds.size) return summary

  const waitingRoom = findWaitingRoom(channels, categoryIds)
  if (!waitingRoom) {
    summary.missingWaitingRoom = true
    return summary
  }

  const members = collectVoiceMembersInCategories(guild, channels, categoryIds, waitingRoom.id)
  for (const member of members) {
    await removeBotcRolesFromVoiceMember(gameManager, member, summary)
    await moveVoiceMemberToWaitingRoom(member, waitingRoom, summary)
  }

  return summary
}

function findWaitingRoom(channels, categoryIds) {
  return channels.find(channel =>
    channel.type === ChannelType.GuildVoice &&
    channel.name === WAITING_ROOM_VOICE_CHANNEL_NAME &&
    categoryIds.has(channel.parentId)
  ) || channels.find(channel =>
    channel.type === ChannelType.GuildVoice &&
    channel.name === WAITING_ROOM_VOICE_CHANNEL_NAME
  ) || null
}

function collectVoiceMembersInCategories(guild, channels, categoryIds, waitingRoomId) {
  const members = new Map()
  const voiceChannels = channels.filter(channel =>
    channel.type === ChannelType.GuildVoice &&
    categoryIds.has(channel.parentId) &&
    channel.id !== waitingRoomId
  )

  for (const channel of voiceChannels) {
    for (const member of getCachedValues(channel.members)) {
      if (member?.id) members.set(member.id, member)
    }
  }

  for (const member of getCachedValues(guild.members?.cache)) {
    if (!member?.id || members.has(member.id)) continue
    const channelId = member.voice?.channelId
    const channel = channels.find(item => item.id === channelId)
    if (channel?.type === ChannelType.GuildVoice && categoryIds.has(channel.parentId) && channel.id !== waitingRoomId) {
      members.set(member.id, member)
    }
  }

  return [...members.values()]
}

async function removeBotcRolesFromVoiceMember(gameManager, member, summary) {
  const removals = [
    { action: 'remove-post-game-voice-player-role', run: () => gameManager.removePlayerRole?.(member) },
    { action: 'remove-post-game-voice-spectator-role', run: () => gameManager.removeSpectatorRole?.(member) },
    { action: 'remove-post-game-voice-storyteller-role', run: () => gameManager.removeStorytellerRole?.(member) },
    { action: 'remove-post-game-voice-grimoire-spectator-role', run: () => gameManager.removeGrimoireSpectatorRole?.(member) }
  ]

  const results = await Promise.all(removals.map(removal => runRoleRemoval(removal, member)))
  if (results.every(result => result !== false)) {
    summary.rolesCleared.push(member.id)
  } else {
    summary.roleClearFailed.push(member.id)
  }

  await gameManager.restoreNickname?.(member)?.catch?.(err => {
    log.recoverable('restore-post-game-voice-member-nickname', err, {
      guildId: member.guild?.id,
      userId: member.id
    })
    return null
  })
}

async function refreshPostGameVoiceChannels(guild) {
  if (!guild?.channels?.fetch) {
    log.recoverable('fetch-post-game-voice-channels-unavailable', new Error('Guild channel API unavailable'), { guildId: guild?.id })
    return null
  }

  return guild.channels.fetch().catch(err => {
    log.recoverable('fetch-post-game-voice-channels', err, { guildId: guild.id })
    return null
  })
}

async function runRoleRemoval(removal, member) {
  return Promise.resolve()
    .then(removal.run)
    .catch(err => {
      log.recoverable(removal.action, err, {
        guildId: member.guild?.id,
        userId: member.id
      })
      return false
    })
}

async function moveVoiceMemberToWaitingRoom(member, waitingRoom, summary) {
  if (member.voice?.channelId === waitingRoom.id) {
    summary.alreadyInWaitingRoom.push(member.id)
    return true
  }

  return queuedVoiceMove(member, waitingRoom)
    .then(() => {
      summary.moved.push(member.id)
      return true
    })
    .catch(err => {
      log.recoverable('move-post-game-voice-member-to-waiting-room', err, {
        channelId: waitingRoom.id,
        guildId: waitingRoom.guildId || waitingRoom.guild?.id,
        userId: member.id
      })
      summary.moveFailed.push({ memberId: member.id, reason: err?.message || String(err || 'unknown error') })
      return false
    })
}

function getCachedValues(cache) {
  if (!cache) return []
  if (Array.isArray(cache)) return cache
  if (typeof cache.values === 'function') return [...cache.values()]
  if (typeof cache[Symbol.iterator] === 'function') return [...cache]
  return Object.values(cache)
}

function createPostGameVoiceCleanupSummary() {
  return {
    moved: [],
    alreadyInWaitingRoom: [],
    rolesCleared: [],
    roleClearFailed: [],
    moveFailed: [],
    missingWaitingRoom: false
  }
}

module.exports = {
  GAME_VOICE_CATEGORY_NAMES,
  cleanupEndedGameVoiceAndRoles,
  collectVoiceMembersInCategories,
  createPostGameVoiceCleanupSummary,
  findWaitingRoom,
  getCachedValues
}
