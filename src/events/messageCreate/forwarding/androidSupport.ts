import { channelMention, Message } from 'discord.js';
import logger from '../../../utils/logger';
import { replaceListWithItem } from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';

const androidSupport = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a target forwarding channel.');
      return message.channel.send('Please tag a channel to forward to.');
    }
  }

  const channelId = firstMentionedChannel.id;

  logger.info(`Saving ${channelId} as ${kvKeys.ANDROID_FORWARDING_CHANNEL}`);
  
  const result = await replaceListWithItem(kvKeys.ANDROID_FORWARDING_CHANNEL, channelId);
  
  if (message.channel.isSendable()) {
    if (result.success) {
      message.channel.send(
        `Saving ${channelMention(channelId)} as ${kvKeys.ANDROID_FORWARDING_CHANNEL}`
      );
    } else {
      logger.error(`Failed to save Android forwarding channel ${channelId}:`, result.error);
      message.channel.send(
        `Failed to save ${channelMention(channelId)} as Android forwarding channel. Please try again.`
      );
    }
  }
};

export default androidSupport;
