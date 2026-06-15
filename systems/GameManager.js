const {
  findGrimoireSpectatorRole
} = require('../utils/grimoireSpectatorRole')
const {
  queuedMemberNicknameSet,
  queuedMemberRoleAdd,
  queuedMemberRoleRemove
} = require('../utils/discord/memberActions')
const {
  queuedGuildRoleCreate
} = require('../utils/discord/roleActions')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../utils/logger')
const {
  createMemberContext,
  createMemberRoleContext,
  runRecoverableBoolean,
  runRecoverableNull
} = require('./game/GameManagerRecoverableActions')
const {
  createGameManagerNicknamePrefixes,
  createGameManagerRoleDefaults
} = require('./game/GameManagerDefaults')
const {
  MANAGED_ROLE_PERMISSIONS,
  ensureManagedGrimoireSpectatorRole,
  keepManagedRolesBelowBot,
  prepareManagedGameRole
} = require('./game/roles/managedRoleMaintenance')
const {
  createPlayerNickname,
  getKnownNicknamePrefixes,
  getPlayerNicknameParts,
  getPlayerNicknameType,
  stripGameNicknameDecorators
} = require('./game/playerNicknames/GameNicknameFormatter')
const {
  ensureGameRolesForGuild
} = require('./game/roles/gameRoleSetup')
const {
  isFakeDiscordUser,
  isFakeDiscordUserId
} = require('./game/GameManagerFakeUsers')

class GameManager {
  constructor(games, { logger = undefined } = {}) {
    this.games = games
    this.log = createBotLogger({ logger, subsystem: 'GameManager' })
    const { roleNames, roleColors } = createGameManagerRoleDefaults()
    this.roleNames = roleNames
    this.roleColors = roleColors
    this.nicknamePrefixes = createGameManagerNicknamePrefixes()
  }

  get(guildId) {
    return this.games.get(guildId)
  }

  async setNickname(member, type) {
    if (!member || !member.manageable) return

    const prefix = this.nicknamePrefixes[type]
    if (!prefix) return

    const baseName = this.stripGameNicknamePrefix(member.displayName || member.user.username)
    await runRecoverableBoolean(
      this.log,
      'set-game-nickname',
      () => queuedMemberNicknameSet(member, prefix + baseName),
      createMemberContext(member, { type })
    )
  }

  async setGameNickname(member, game, userId = member?.id) {
    const user = game?.users?.[userId]
    if (!user) return

    if (user.role === 'player') {
      const nickname = createPlayerNickname(
        member.displayName || member.user.username,
        game,
        userId,
        this.nicknamePrefixes
      )
      return runRecoverableBoolean(
        this.log,
        'set-player-game-nickname',
        () => queuedMemberNicknameSet(member, nickname),
        createMemberContext(member, { userId })
      )
    }

    if (user.role === 'spectator' && this.hasGrimoireSpectatorRole(member)) {
      return this.setNickname(member, 'grimoireSpectator')
    }

    return this.setNickname(member, user.role)
  }

  getPlayerNicknamePrefix(game, userId) {
    return getPlayerNicknameParts(game, userId, this.nicknamePrefixes).prefix
  }

  getPlayerNicknameType(game, userId) {
    return getPlayerNicknameType(game, userId)
  }

  async restoreNickname(member) {
    if (!member || !member.manageable) return

    const currentName = member.displayName || member.user.username
    const restoredName = this.stripGameNicknamePrefix(currentName)

    if (restoredName === currentName) return
    await runRecoverableBoolean(
      this.log,
      'restore-member-nickname',
      () => queuedMemberNicknameSet(member, restoredName),
      createMemberContext(member)
    )
  }

  stripGameNicknamePrefix(name) {
    return stripGameNicknameDecorators(name, this.nicknamePrefixes)
  }

  getKnownNicknamePrefixes() {
    return getKnownNicknamePrefixes(this.nicknamePrefixes)
  }

  async addPlayerRole(member) {
    return this.addGameRole(member, 'player')
  }

  async removePlayerRole(member) {
    return this.removeGameRole(member, 'player')
  }

  async removePlayerRoleFromUsers(guild, userIds) {
    for (const userId of userIds) {
      if (isFakeDiscordUserId(userId)) continue
      const member = await this.fetchGuildMember(guild, userId, 'fetch-player-role-removal-member')
      if (member) await this.removePlayerRole(member)
    }
  }

  async removeGameRolesFromUsers(guild, users) {
    let ok = true

    for (const [userId, user] of Object.entries(users || {})) {
      if (isFakeDiscordUser(userId, user)) continue
      const member = await this.fetchGuildMember(guild, userId, 'fetch-game-role-removal-member')
      if (!member) continue

      if (user.role === 'player') ok = await this.removePlayerRole(member) && ok
      if (user.role === 'spectator') ok = await this.removeSpectatorRole(member) && ok
      if (user.role === 'storyteller') ok = await this.removeStorytellerRole(member) && ok
      ok = await this.removeGrimoireSpectatorRole(member) && ok

      await this.restoreNickname(member)
    }

    return ok
  }

  async fetchGuildMember(guild, userId, action) {
    return fetchGuildMemberWithRecoverableFallback({
      action,
      guild,
      logger: this.log,
      userId
    })
  }

  async addSpectatorRole(member) {
    return this.addGameRole(member, 'spectator')
  }

  async removeSpectatorRole(member) {
    return this.removeGameRole(member, 'spectator')
  }

  async addGrimoireSpectatorRole(member) {
    const role = await ensureManagedGrimoireSpectatorRole(member?.guild)
    if (!role) return false

    return runRecoverableBoolean(
      this.log,
      'add-grimoire-spectator-role',
      () => queuedMemberRoleAdd(member, role),
      createMemberRoleContext(member, role)
    )
  }

  async removeGrimoireSpectatorRole(member) {
    const role = findGrimoireSpectatorRole(member?.guild)
    if (!role) return true

    return runRecoverableBoolean(
      this.log,
      'remove-grimoire-spectator-role',
      () => queuedMemberRoleRemove(member, role),
      createMemberRoleContext(member, role)
    )
  }

  hasGrimoireSpectatorRole(member) {
    const role = findGrimoireSpectatorRole(member?.guild)
    return Boolean(role && member?.roles?.cache?.has?.(role.id))
  }

  async addStorytellerRole(member) {
    return this.addGameRole(member, 'storyteller')
  }

  async removeStorytellerRole(member) {
    return this.removeGameRole(member, 'storyteller')
  }

  async addGameRole(member, type) {
    const role = await this.getOrCreateGameRole(member, type)
    if (!role) return false

    return runRecoverableBoolean(
      this.log,
      'add-game-role',
      () => queuedMemberRoleAdd(member, role),
      createMemberRoleContext(member, role, { type })
    )
  }

  async removeGameRole(member, type) {
    const role = member?.guild?.roles?.cache?.find(role => role.name === this.roleNames[type])
    if (!role) return true

    return runRecoverableBoolean(
      this.log,
      'remove-game-role',
      () => queuedMemberRoleRemove(member, role),
      createMemberRoleContext(member, role, { type })
    )
  }

  hasGameRole(member, type) {
    const roleName = this.roleNames[type]
    if (!roleName) return false

    return Boolean(member?.roles?.cache?.some?.(role => role.name === roleName))
  }

  async getOrCreateGameRole(member, type) {
    return this.getOrCreateGameRoleForGuild(member?.guild, type)
  }

  async getOrCreateGameRoleForGuild(guild, type) {
    const roleName = this.roleNames[type]
    if (!roleName || !guild) return null

    const existing = guild.roles.cache.find(role => role.name === roleName)
    if (existing) return prepareManagedGameRole(guild, existing, type, this.roleColors[type])

    const role = await runRecoverableNull(
      this.log,
      'create-game-role',
      () => queuedGuildRoleCreate(guild, {
        name: roleName,
        color: this.roleColors[type],
        permissions: MANAGED_ROLE_PERMISSIONS,
        reason: `BOTC ${type} role`
      }),
      { guildId: guild.id, roleName, type }
    )
    return role ? prepareManagedGameRole(guild, role, type, this.roleColors[type]) : null
  }

  async ensureGameRoles(guild) {
    return ensureGameRolesForGuild(this, guild)
  }

  async keepGameRolesBelowBot(guild, roles) {
    return keepManagedRolesBelowBot(guild, roles)
  }

}

module.exports = GameManager
