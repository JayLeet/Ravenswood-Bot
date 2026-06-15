const { ensurePlayerNightArea } = require('../nightArea')
const { findOrCreateReservedNightCategory } = require('../nightArea/reservedChannels')

function createNightActionAreaHelpers({ gameLifecycle, logger }) {
  async function ensurePlayerNightChannel(interaction, context, targetMember) {
    const area = await ensurePlayerNightAreaForGuild(interaction.client, interaction.guild, context.serverConfig, context.game, context.view, targetMember)
    return area?.textChannel || null
  }

  async function ensurePlayerNightVoiceChannel(interaction, context, targetMember) {
    const area = await ensurePlayerNightAreaForGuild(interaction.client, interaction.guild, context.serverConfig, context.game, context.view, targetMember)
    return area?.voiceChannel || null
  }

  async function ensurePlayerNightChannelForGuild(discordClient, guild, serverConfig, game, view, targetMember) {
    const area = await ensurePlayerNightAreaForGuild(discordClient, guild, serverConfig, game, view, targetMember)
    return area?.textChannel || null
  }

  async function ensurePlayerNightAreaForGuild(discordClient, guild, serverConfig, game, view, targetMember) {
    const parent = await findNightChannelParent(discordClient, guild, serverConfig)
    return ensurePlayerNightArea({ discordClient, guild, parent, game, gameLifecycle, member: targetMember, view })
  }

  async function findNightChannelParent(discordClient, guildOrServerConfig, maybeServerConfig = null) {
    const guild = maybeServerConfig ? guildOrServerConfig : null
    const serverConfig = maybeServerConfig || guildOrServerConfig
    const cottageCategory = guild ? await findOrCreateReservedNightCategory(guild) : null
    if (cottageCategory) return cottageCategory

    for (const channelId of [serverConfig.storytellerChannelId, serverConfig.liveChannelId, serverConfig.spectatorChannelId, serverConfig.gameChannelId]) {
      if (!channelId) continue
      const channel = await discordClient.channels.fetch(channelId).catch(err => {
        logger?.recoverable?.('fetch-night-parent-source-channel', err, {
          channelId,
          guildId: guild?.id
        })
        return null
      })
      if (channel?.parent) return channel.parent
    }

    return null
  }

  return {
    ensurePlayerNightChannel,
    ensurePlayerNightVoiceChannel,
    ensurePlayerNightChannelForGuild,
    ensurePlayerNightAreaForGuild,
    findNightChannelParent
  }
}

module.exports = {
  createNightActionAreaHelpers
}
