import {
  channelMention,
  EmbedBuilder,
  GuildBasedChannel,
  Message,
  PartialGroupDMChannel
} from 'discord.js';
import {
  extractWorldId,
  extractWorldLink,
  removeVRChatLink
} from '../../utils/regex';
import logger from '../../utils/logger';
import { vrchat } from '../../utils/vrchat';
import {
  getSupportedPlatforms,
  getWorldNameId,
  hasAndroidSupport
} from '../../utils/helpers';
import { isChannelOnWatchList } from '../../utils/jsonAsDb/watchedChannels';
import { getFirstItemInList } from '../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../utils/jsonAsDb/types';

const watchForVRCWorldLinks = async (message: Message) => {
  if (!(await isChannelOnWatchList(message.channelId))) {
    return;
  }

  const worldId = extractWorldId(message.content);

  if (!worldId) return;

  logger.info(`${message.content} detected as valid VRC World link ${worldId}`);

  // Fetch data from world id
  const { data } = await vrchat.getWorld({
    client: vrchat.client,
    path: { worldId }
  });

  logger.info(`Retrieved World info for world ${getWorldNameId(data)}`);

  const supportedPlatform = getSupportedPlatforms(data.unityPackages);

  const embed = new EmbedBuilder()
    .setTitle(`${data.name} by ${data.authorName}`)
    .setURL(extractWorldLink(message.content))
    .setThumbnail(data.imageUrl)
    .setDescription(removeVRChatLink(message.content))
    .addFields(
      {
        name: 'Max slots',
        value: `${data.capacity}`,
        inline: true
      },
      {
        name: 'Additional Platforms',
        value: hasAndroidSupport(supportedPlatform)
          ? '✅ Quest/Android supported'
          : '❌ N/A',
        inline: true
      }
    )
    .setFooter({
      iconURL: message.author.avatarURL(),
      text: `Submitted by ${message.author.displayName}`
    })
    .setTimestamp();

  //#region Link forwarding
  let forwarded = false;
  const forwardToChannel = async (channelId: string, tag: string) => {
    // Check if channel exists
    const forwardingChannel = message.guild.channels.cache.get(channelId);

    if (forwardingChannel && forwardingChannel.isSendable()) {
      logger.info(
        `[${tag}] Forwarding ${getWorldNameId(data)} to ${channelMention(forwardingChannel.id)}`
      );
      await message.react('⤴️');
      forwardingChannel.send({ embeds: [embed] });
    }
  };

  // Android support
  const androidForwardingChannel = await getFirstItemInList(
    kvKeys.ANDROID_FORWARDING_CHANNEL
  );
  if (androidForwardingChannel && hasAndroidSupport(supportedPlatform)) {
    forwarded = true;
    await forwardToChannel(androidForwardingChannel, 'Android Support');
  }

  // Player count >= 60
  const playerCountForwardingChannel = await getFirstItemInList(
    kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL
  );

  if (playerCountForwardingChannel && data.capacity >= 60) {
    forwarded = true;
    await forwardToChannel(playerCountForwardingChannel, 'Player Cap >= 60');
  }
  //#endregion

  if (!forwarded && message.channel.isSendable()) {
    await message.react('✅');
    return message.channel.send({ embeds: [embed] });
  }
};

export default watchForVRCWorldLinks;
