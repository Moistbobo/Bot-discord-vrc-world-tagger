import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import {
  isChannelOnWatchList,
  removeChannelFromWatch
} from '../../utils/jsonAsDb/watchedChannels';

export const unWatchChannel = async (message: Message) => {
  const channelId = message.channelId;

  if (!(await isChannelOnWatchList(channelId))) {
    logger.error(`${channelId} is not being watched.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is not being watched.`
      );
    }
  } else {
    await removeChannelFromWatch(channelId);
    if (message.channel.isSendable()) {
      message.channel.send(
        `Removed ${channelMention(channelId)} from watch list.`
      );
    }
  }
};
