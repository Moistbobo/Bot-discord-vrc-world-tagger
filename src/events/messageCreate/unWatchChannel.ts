import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import {
  isItemInList,
  removeItemFromList
} from '../../utils/jsonAsDb/getSetValue';
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

  if (!(await isItemInList(kvKeys.WATCHED_CHANNELS, channelId))) {
    logger.error(`${channelId} is not being watched.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is not being watched.`
      );
    }
  } else {
    await removeItemFromList(kvKeys.WATCHED_CHANNELS, channelId);
    if (message.channel.isSendable()) {
      message.channel.send(
        `Removed ${channelMention(channelId)} from watch list.`
      );
    }
  }
};
