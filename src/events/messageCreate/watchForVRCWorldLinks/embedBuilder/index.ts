import { EmbedBuilder } from 'discord.js';
import { World } from 'vrchat';
import { buildWorldUrl } from '../../../../utils/helpers';
import { emojiMap } from '../../../../assets/icons';
import Config from '../../../../assets/config';

/**
 * Creates Discord embed for world information
 */
export const createWorldEmbed = (
  data: World,
  worldId: string,
  supportedPlatforms: string[],
  packageSizes: number[],
  originalContent: string
): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setTitle(`${data.name} by ${data.authorName}`)
    .setURL(buildWorldUrl(worldId))
    .setThumbnail(data.imageUrl)
    .setDescription(originalContent)
    .addFields(
      {
        name: 'Max slots',
        value: `${data.capacity}`,
        inline: true
      },
      {
        name: 'Platforms',
        value: supportedPlatforms
          .map((platform) => `${emojiMap[platform]}`)
          .join(' '),
        inline: true
      },
      {
        name: 'Download Size',
        value: supportedPlatforms
          .map(
            (platform, idx) =>
              `${emojiMap[platform]}: ${packageSizes[idx].toFixed(2)}MB`
          )
          .join('\n'),
        inline: true
      }
    )
    .setTimestamp();

  if (Config.DEV_MODE) {
    embed.setFooter({
      text: 'Dev mode on. Duplicate checks have been disabled.'
    });
  }
  return embed;
};
