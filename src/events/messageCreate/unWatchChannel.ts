import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { isItemInList, removeItemFromList } from '../../utils/jsonAsDb';
import { kvKeys } from '../../utils/jsonAsDb/types';

export const unWatchChannel = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a channel to unwatch.');
      return message.channel.send('Please tag a channel to unwatch.');
    }
  }

  const channelId = firstMentionedChannel.id;

  const isWatched = await isItemInList(kvKeys.WATCHED_CHANNELS, channelId);

  if (!isWatched) {
    logger.error(`${channelId} is not being watched.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is not being watched.`
      );
    }
  } else {
    const result = await removeItemFromList(kvKeys.WATCHED_CHANNELS, channelId);

    if (message.channel.isSendable()) {
      if (result.success) {
        message.channel.send(
          `Removed ${channelMention(channelId)} from watch list.`
        );
      } else {
        logger.error(
          `Failed to remove channel ${channelId} from watch list:`,
          result.error
        );
        message.channel.send(
          `Failed to remove ${channelMention(channelId)} from watch list. Please try again.`
        );
      }
    }
  }
};
