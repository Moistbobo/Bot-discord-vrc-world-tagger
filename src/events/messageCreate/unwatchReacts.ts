import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { has, remove } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

export const unwatchReacts = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a channel to unwatch for reactions.');
      return message.channel.send(
        'Please tag a channel to unwatch for reaction forwarding.'
      );
    }
    return;
  }

  const channelId = firstMentionedChannel.id;

  const isWatched = await has(kvKeys.WATCHED_REACTION_CHANNELS, channelId);

  if (!isWatched) {
    logger.error(`${channelId} is not being watched for reaction forwarding.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is not being watched for reaction forwarding.`
      );
    }
  } else {
    const result = await remove(kvKeys.WATCHED_REACTION_CHANNELS, channelId);

    if (message.channel.isSendable()) {
      if (result.success) {
        message.channel.send(
          `Removed ${channelMention(channelId)} from reaction forwarding watch list.`
        );
      } else {
        logger.error(
          `Failed to remove channel ${channelId} from reaction watch list:`,
          result.error
        );
        message.channel.send(
          `Failed to remove ${channelMention(channelId)} from reaction forwarding watch list. Please try again.`
        );
      }
    }
  }
};
