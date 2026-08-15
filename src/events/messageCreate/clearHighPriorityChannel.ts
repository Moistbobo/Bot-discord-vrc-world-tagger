import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { clear } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const clearHighPriorityChannel = async (message: Message) => {
  try {
    const result = await clear(kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL);
    if (message.channel.isSendable()) {
      await message.channel.send(
        result.success
          ? 'Cleared the high priority channel configuration.'
          : 'Failed to clear the high priority channel.'
      );
    }
    if (result.success) {
      logger.info(`High priority channel cleared by ${message.author.tag}`);
    }
  } catch (error) {
    logger.error('Failed to clear high priority channel:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'An unexpected error occurred while clearing the high priority channel.'
      );
    }
  }
};

export default clearHighPriorityChannel;
