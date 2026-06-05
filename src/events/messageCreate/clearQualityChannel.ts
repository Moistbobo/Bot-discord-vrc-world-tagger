import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { clear } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const VALID_QUALITIES = ['good', 'bad'] as const;
type Quality = (typeof VALID_QUALITIES)[number];

function getKvKey(quality: Quality): kvKeys {
  return quality === 'good'
    ? kvKeys.QUALITY_GOOD_FORWARDING_CHANNEL
    : kvKeys.QUALITY_BAD_FORWARDING_CHANNEL;
}

const clearQualityChannel = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);
  const quality = parts[1]?.toLowerCase() as Quality | undefined;

  if (!quality || !VALID_QUALITIES.includes(quality)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please specify **good** or **bad**. Usage: `.clearQualityChannel good|bad`'
      );
    }
    return;
  }

  try {
    const result = await clear(getKvKey(quality));
    if (message.channel.isSendable()) {
      await message.channel.send(
        result.success
          ? `Cleared the **${quality}** maps quality channel configuration.`
          : `Failed to clear the **${quality}** quality channel.`
      );
    }
    if (result.success) {
      logger.info(
        `Quality channel for "${quality}" cleared by ${message.author.tag}`
      );
    }
  } catch (error) {
    logger.error('Failed to clear quality channel:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'An unexpected error occurred while clearing the quality channel.'
      );
    }
  }
};

export default clearQualityChannel;
