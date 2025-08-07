import { EmbedBuilder, Message } from 'discord.js';
import { World } from 'vrchat';
import logger from '../../../utils/logger';
import { add, getFirst } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import { hasAndroidSupport } from '../../../utils/helpers';
import { emojiMap } from '../../../assets/icons';

// Constants
export const PLAYER_CAPACITY_THRESHOLD = 60;

// Types
export interface ForwardingChannel {
  id: string;
  tag: string;
}

/**
 * Adds world to processed worlds list
 */
export const markWorldAsProcessed = async (worldId: string): Promise<void> => {
  const result = await add(kvKeys.PROCESSED_WORLDS, worldId, true);
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
  const androidChannel = await getFirst(kvKeys.ANDROID_FORWARDING_CHANNEL);
  if (androidChannel && hasAndroidSupport(supportedPlatforms)) {
    channels.push({ id: androidChannel, tag: 'Android Support' });
  }

  // Check player capacity threshold
  const playerCountChannel = await getFirst(
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
    await message.react(emojiMap.checkmark);
    await markWorldAsProcessed(worldId);

    await message.reply({
      allowedMentions: { repliedUser: false },
      embeds: [embed]
    });
  } catch (error) {
    logger.error('Failed to send response to original message:', error);
  }
};
