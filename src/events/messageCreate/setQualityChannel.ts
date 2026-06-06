import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { add, clear, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const VALID_QUALITIES = ['good', 'bad'] as const;
type Quality = (typeof VALID_QUALITIES)[number];

function getKvKey(quality: Quality): kvKeys {
  return quality === 'good'
    ? kvKeys.QUALITY_GOOD_FORWARDING_CHANNEL
    : kvKeys.QUALITY_BAD_FORWARDING_CHANNEL;
}

const setQualityChannel = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);

  const quality = parts[1]?.toLowerCase() as Quality | undefined;
  const firstMention = message.mentions.channels.first();

  if (!quality || !VALID_QUALITIES.includes(quality)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please specify **good** or **bad**. Usage: `.setQualityChannel good|bad #channel`'
      );
    }
    return;
  }

  if (!firstMention) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please mention a channel. Usage: `.setQualityChannel good|bad #channel`'
      );
    }
    return;
  }

  const channelId = firstMention.id;
  const kvKey = getKvKey(quality);

  try {
    const result = await has(kvKey, channelId);
    if (result) {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `${channelMention(channelId)} is already the "${quality}" quality channel.`
        );
      }
      return;
    }

    // For quality channels we only want one per quality; clear previous first
    await clear(kvKey);

    // Now add the new one
    const addResult = await add(kvKey, channelId, true);

    if (!addResult.success) {
      throw new Error(addResult.error || 'Failed to persist');
    }

    if (message.channel.isSendable()) {
      await message.channel.send(
        `Set ${channelMention(channelId)} as the **${quality}** maps channel. ` +
          `When a world is forwarded there via reaction, the bot will mark its quality in the database.`
      );
    }

    logger.info(
      `Quality channel for "${quality}" set to ${channelId} by ${message.author.tag}`
    );
  } catch (error) {
    logger.error('Failed to set quality channel:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to set the quality channel. Please try again.'
      );
    }
  }
};

export default setQualityChannel;
