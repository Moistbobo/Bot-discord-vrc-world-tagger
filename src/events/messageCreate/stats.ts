import { EmbedBuilder, Message } from 'discord.js';
import logger from '../../utils/logger';
import { getAll } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

export const stats = async (message: Message) => {
  try {
    // Get various statistics from the database
    const processedWorlds = await getAll(kvKeys.PROCESSED_WORLDS);
    const processedWorldsCount = processedWorlds.length;

    const watchedChannels = await getAll(kvKeys.WATCHED_CHANNELS);
    const watchedChannelsCount = watchedChannels.length;

    const playerCountForwardingChannel = await getAll(
      kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL
    );
    const playerCountForwardingCount = playerCountForwardingChannel.length;

    const androidForwardingChannel = await getAll(
      kvKeys.ANDROID_FORWARDING_CHANNEL
    );
    const androidForwardingCount = androidForwardingChannel.length;

    // Calculate total forwarding channels
    const totalForwardingChannels =
      playerCountForwardingCount + androidForwardingCount;

    // Get bot uptime
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    // Get system information
    const nodeVersion = process.version;
    const platform = process.platform;

    // Get last processed world (if any)
    const lastProcessedWorld =
      processedWorlds.length > 0
        ? processedWorlds[processedWorlds.length - 1]
        : 'None';

    // Create a Discord embed with comprehensive statistics
    const embed = new EmbedBuilder()
      .setColor(0x0099ff) // Blue color
      .setTitle('🤖 VRC World Tagger Bot Statistics')
      .setDescription(
        'Comprehensive overview of bot activity and configuration:'
      )
      .addFields(
        {
          name: '🌍 Worlds Processed',
          value: `**${processedWorldsCount}** worlds`,
          inline: true
        },
        {
          name: '👀 Channels Watched',
          value: `**${watchedChannelsCount}** channels`,
          inline: true
        },
        {
          name: '📡 Forwarding Channels',
          value: `**${totalForwardingChannels}** total`,
          inline: true
        },
        {
          name: '📊 Player Count Forwarding',
          value:
            playerCountForwardingCount > 0
              ? `**${playerCountForwardingCount}** channels`
              : 'None configured',
          inline: true
        },
        {
          name: '🤖 Android Support Forwarding',
          value:
            androidForwardingCount > 0
              ? `**${androidForwardingCount}** channels`
              : 'None configured',
          inline: true
        },
        {
          name: '⏰ Bot Uptime',
          value: `**${uptimeHours}h ${uptimeMinutes}m**`,
          inline: true
        },
        {
          name: '💾 Memory Usage',
          value: `**${memoryUsageMB} MB**`,
          inline: true
        },
        {
          name: '🔧 Node.js Version',
          value: `**${nodeVersion}**`,
          inline: true
        },
        {
          name: '💻 Platform',
          value: `**${platform}**`,
          inline: true
        },
        {
          name: '🔄 Last Processed World',
          value:
            lastProcessedWorld.length > 50
              ? `${lastProcessedWorld.substring(0, 47)}...`
              : lastProcessedWorld,
          inline: false
        },
        {
          name: '📈 Total Activity',
          value: `The bot has successfully processed **${processedWorldsCount}** VRChat worlds to date!`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'VRC World Tagger Bot • Use .stats to view this again'
      });

    if (message.channel.isSendable()) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Failed to get bot statistics:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        '❌ Failed to retrieve bot statistics. Please try again later.'
      );
    }
  }
};
