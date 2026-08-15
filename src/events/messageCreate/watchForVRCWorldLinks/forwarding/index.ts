import {
  EmbedBuilder,
  Message,
  messageLink,
  OmitPartialGroupDMChannel
} from 'discord.js';
import { World } from '../../../../utils/apiClient';
import logger from '../../../../utils/logger';
import { getFirst } from '../../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../../utils/jsonAsDb/types';
import { hasAndroidSupport } from '../../../../utils/helpers';
import { emojiMap } from '../../../../assets/media';
import Config from '../../../../assets/config';

// Constants
export const PLAYER_CAPACITY_THRESHOLD = Config.FORWARD_PLAYER_COUNT_THRESHOLD;
export const LOW_CAPACITY_THRESHOLD = Config.LOW_CAPACITY_THRESHOLD;

export interface ForwardingChannel {
  id: string;
  tag: string;
}

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

    await message.forward(forwardingChannel.id);
  } catch (error) {
    if (error.code === 40005) {
      logger.warn(
        `Failed to forward to channel ${channelId} due to discord upload limit. Forwarding using alternative method.`
      );

      if (forwardingChannel.isSendable()) {
        await forwardingChannel.send({
          content: `Message omitted due to size — ${messageLink(message.channelId, message.id)}.`,
          embeds: [embed]
        });
      }
    } else {
      logger.error(`Failed to forward to channel ${channelId}:`, error);
    }
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

  // Check player capacity threshold (high capacity)
  const playerCountChannel = await getFirst(
    kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL
  );
  if (playerCountChannel && data.capacity >= PLAYER_CAPACITY_THRESHOLD) {
    channels.push({
      id: playerCountChannel,
      tag: `Player Cap >= ${PLAYER_CAPACITY_THRESHOLD}`
    });
  }

  // Check low capacity threshold
  const lowCapacityChannel = await getFirst(
    kvKeys.LOW_CAPACITY_FORWARDING_CHANNEL
  );
  if (lowCapacityChannel && data.capacity <= LOW_CAPACITY_THRESHOLD) {
    channels.push({
      id: lowCapacityChannel,
      tag: `Low Cap <= ${LOW_CAPACITY_THRESHOLD}`
    });
  }

  return channels;
};

/**
 * Sends response to the original message
 */
export const sendResponse = async (
  message: Message,
  embed: EmbedBuilder
): Promise<OmitPartialGroupDMChannel<Message<boolean>> | undefined> => {
  if (!message.channel.isSendable()) {
    return;
  }

  try {
    await message.react(emojiMap.checkmark);

    const responseMsg = await message.reply({
      allowedMentions: { repliedUser: false },
      embeds: [embed]
    });

    return responseMsg;
  } catch (error) {
    logger.error('Failed to send response to original message:', error);
  }
};
