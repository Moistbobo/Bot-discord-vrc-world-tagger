import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import {
  addNewChannelToWatch,
  isChannelOnWatchList
} from '../../utils/jsonAsDb/watchedChannels';

export const watchChannel = async (message: Message) => {
  const channelId = message.channelId;

  if (await isChannelOnWatchList(channelId)) {
    logger.error(`Channel ID ${channelId} is already being watched.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is already being watched.`
      );
    }
  } else {
    await addNewChannelToWatch(channelId);
    if (message.channel.isSendable()) {
      message.channel.send(
        `Now watching ${channelMention(channelId)} for world links.`
      );
    }
  }
};
