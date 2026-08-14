import { EmbedBuilder, Message } from 'discord.js';
import logger from '../../utils/logger';
import { has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import { api } from '../../utils/apiClient';
import packageJson from '../../../package.json';

export const stats = async (message: Message) => {
  try {
    const isChannelWatched = await has(
      kvKeys.WATCHED_CHANNELS,
      message.channelId
    );
    if (!isChannelWatched) return;

    const { worldCount: totalWorlds, topTags: tagDistribution } =
      await api.getStats();
    const lastRecord = await api.getLastProcessedWorld();

    // Top 5 tags by count
    const topTags = tagDistribution
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const memoryUsageMB = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🤖 VRC World Tagger Bot Statistics')
      .setDescription(
        'Comprehensive overview of bot activity and configuration:'
      )
      .addFields(
        {
          name: '🌍 Worlds Processed',
          value: `**${totalWorlds}** worlds`,
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
          name: '💻 Platform',
          value: `**${process.platform}**`,
          inline: true
        },
        {
          name: '🏷️ Bot Version',
          value: `**v${packageJson.version}**`,
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'VRC World Tagger Bot • Use .stats to view this again'
      });

    if (lastRecord) {
      embed.addFields({
        name: '🔄 Last Processed World',
        value: `[${lastRecord.name}](https://vrchat.com/home/world/${lastRecord.worldId}) by ${lastRecord.authorName}`,
        inline: false
      });
    }

    if (topTags.length > 0) {
      embed.addFields({
        name: '📊 Top Tags',
        value: topTags.map((t) => `\`${t.tag}\` — **${t.count}**`).join(' | '),
        inline: false
      });
    }

    embed.addFields({
      name: '📈 Total Activity',
      value: `The bot has successfully processed **${totalWorlds}** VRChat worlds to date!`,
      inline: false
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
