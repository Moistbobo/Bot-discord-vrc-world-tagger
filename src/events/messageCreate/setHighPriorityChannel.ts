import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { add, clear, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const setHighPriorityChannel = async (message: Message) => {
  const firstMention = message.mentions.channels.first();

  if (!firstMention) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please mention a channel. Usage: `.setHighPriorityChannel #channel`'
      );
    }
    return;
  }

  const channelId = firstMention.id;

  try {
    const result = await has(
      kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL,
      channelId
    );
    if (result) {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `${channelMention(channelId)} is already the high priority channel.`
        );
      }
      return;
    }

    // Only one high priority channel; clear previous first
    await clear(kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL);

    const addResult = await add(
      kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL,
      channelId,
      true
    );

    if (!addResult.success) {
      throw new Error(addResult.error || 'Failed to persist');
    }

    if (message.channel.isSendable()) {
      await message.channel.send(
        `Set ${channelMention(channelId)} as the high priority channel. ` +
          `When a world is forwarded there via reaction, the bot will mark it as high priority. ` +
          `React-to-delete on a world in this channel removes the high priority mark.`
      );
    }

    logger.info(
      `High priority channel set to ${channelId} by ${message.author.tag}`
    );
  } catch (error) {
    logger.error('Failed to set high priority channel:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to set the high priority channel. Please try again.'
      );
    }
  }
};

export default setHighPriorityChannel;
