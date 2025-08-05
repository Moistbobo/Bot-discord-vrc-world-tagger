import { EmbedBuilder, Message } from 'discord.js';
import { extractWorldId, getLinkFromMessage } from '../../../utils/regex';
import logger from '../../../utils/logger';
import { vrchat } from '../../../utils/vrchat';
import {
  buildWorldUrl,
  getSupportedPlatforms,
  hasAndroidSupport,
  getFileSizeForPlatform
} from '../../../utils/helpers';
import {
  addItemToList,
  getFirstItemInList,
  getKvp,
  saveKvp
} from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import getWorldLinkFromTwitterLink from '../../../utils/externalApi/vxtwitter';
import { emojiMap } from '../../../assets/icons';
import { World } from 'vrchat';

// Constants
export const PLAYER_CAPACITY_THRESHOLD = 60;

// Types
export interface ForwardingChannel {
  id: string;
  tag: string;
}

/**
 * Checks if a world has already been processed and handles duplicate responses
 * @param message - The Discord message
 * @param worldId - The world ID to check
 * @returns Promise resolving to true if world is a duplicate, false if new
 */
export const checkAndHandleDuplicate = async (
  message: Message,
  worldId: string
): Promise<boolean> => {
  // Check if world has already been processed and generate original message link if so
  const originalMessageId = await getKvp(
    kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
    `${worldId}-${message.guildId}`
  );

  if (originalMessageId) {
    logger.info(
      `World id ${worldId} has already been shared, retrieving original message id...`
    );

    // Try to get the channelId from the current message
    const channelId = message.channelId;
    const guildId = message.guildId;

    if (guildId && channelId) {
      const originalMessageLink = `https://discord.com/channels/${guildId}/${channelId}/${originalMessageId}`;

      // React to the original message with a recycle emoji
      try {
        await message.react('♻️');
      } catch (err) {
        logger.warn(`Failed to react with recycle emoji: ${err}`);
      }

      if (message.channel.isSendable()) {
        await message.channel.send(
          `${emojiMap.actually} Uhm Ackhusally this is a duplicate of ${originalMessageLink}`
        );
      } else {
        logger.warn(
          `Message channel is not sendable, skipping original message link for world ${worldId}`
        );
      }
      return true; // World is a duplicate
    }
  } else {
    // Save the original message ID for this world
    await saveKvp(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      `${worldId}-${message.guildId}`,
      message.id
    );

    logger.info(
      `Saving original message ID for world ${worldId}-${message.guildId}: ${message.id}`
    );
  }

  return false; // World is new
};

/**
 * Extracts world ID from message content or Twitter links
 */
export const extractWorldIdFromMessage = async (
  content: string
): Promise<string | null> => {
  const directWorldId = extractWorldId(content);
  if (directWorldId) {
    return directWorldId;
  }

  const twitterLink = getLinkFromMessage(content);
  if (twitterLink) {
    return extractWorldId(await getWorldLinkFromTwitterLink(twitterLink));
  }

  return null;
};

/**
 * Fetches world data from VRChat API
 */
export const fetchWorldData = async (worldId: string): Promise<World> => {
  const { data } = await vrchat.getWorld({
    client: vrchat.client,
    path: { worldId }
  });

  return data;
};

/**
 * Calculates package sizes for all supported platforms
 */
export const calculatePackageSizes = async (data: World): Promise<number[]> => {
  const supportedPlatforms = getSupportedPlatforms(data.unityPackages);

  const sizePromises = supportedPlatforms.map(async (platform) => {
    return await getFileSizeForPlatform(
      data,
      platform as 'standalonewindows' | 'android'
    );
  });

  return await Promise.all(sizePromises);
};

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
  return new EmbedBuilder()
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
};

/**
 * Adds world to processed worlds list
 */
export const markWorldAsProcessed = async (worldId: string): Promise<void> => {
  const result = await addItemToList(kvKeys.PROCESSED_WORLDS, worldId, true);
  if (!result.success) {
    logger.error(
      `Failed to add world ${worldId} to processed worlds:`,
      result.error
    );
  }
};

/**
 * Forwards world information to a specific channel
 */
export const forwardToChannel = async (
  message: Message,
  channelId: string,
  tag: string,
  embed: EmbedBuilder,
  worldId: string
): Promise<void> => {
  const forwardingChannel = message.guild?.channels.cache.get(channelId);

  if (!forwardingChannel?.isSendable()) {
    logger.warn(`Channel ${channelId} is not available for forwarding`);
    return;
  }

  try {
    logger.info(`[${tag}] Forwarding ${worldId} to ${forwardingChannel.id}`);

    await markWorldAsProcessed(worldId);

    const forwardedMessage = await message.forward(forwardingChannel.id);
    if (forwardedMessage.channel.isSendable()) {
      await forwardedMessage.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(`Failed to forward to channel ${channelId}:`, error);
  }
};

/**
 * Determines which channels to forward to based on world criteria
 */
export const getForwardingChannels = async (
  data: World,
  supportedPlatforms: string[]
): Promise<ForwardingChannel[]> => {
  const channels: ForwardingChannel[] = [];

  // Check Android support
  const androidChannel = await getFirstItemInList(
    kvKeys.ANDROID_FORWARDING_CHANNEL
  );
  if (androidChannel && hasAndroidSupport(supportedPlatforms)) {
    channels.push({ id: androidChannel, tag: 'Android Support' });
  }

  // Check player capacity threshold
  const playerCountChannel = await getFirstItemInList(
    kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL
  );
  if (playerCountChannel && data.capacity >= PLAYER_CAPACITY_THRESHOLD) {
    channels.push({ id: playerCountChannel, tag: 'Player Cap >= 60' });
  }

  return channels;
};

/**
 * Sends response to the original message
 */
export const sendResponse = async (
  message: Message,
  embed: EmbedBuilder,
  worldId: string
): Promise<void> => {
  if (!message.channel.isSendable()) {
    return;
  }

  try {
    await message.react('✅');
    await markWorldAsProcessed(worldId);

    await message.reply({
      allowedMentions: { repliedUser: false },
      embeds: [embed]
    });
  } catch (error) {
    logger.error('Failed to send response to original message:', error);
  }
};
