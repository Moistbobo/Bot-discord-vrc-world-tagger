import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { addItemToList, isItemInList } from '../../utils/jsonAsDb';
import { kvKeys } from '../../utils/jsonAsDb/types';

export const watchChannel = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a channel to watch.');
      return message.channel.send('Please tag a channel to watch.');
    }
  }

  const channelId = firstMentionedChannel.id;

  const isAlreadyWatched = await isItemInList(
    kvKeys.WATCHED_CHANNELS,
    channelId
  );

  if (isAlreadyWatched) {
    logger.error(`Channel ID ${channelId} is already being watched.`);
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is already being watched.`
      );
    }
  } else {
    const result = await addItemToList(kvKeys.WATCHED_CHANNELS, channelId);

    if (message.channel.isSendable()) {
      if (result.success) {
        message.channel.send(
          `Now watching ${channelMention(channelId)} for world links.`
        );
      } else {
        logger.error(
          `Failed to add channel ${channelId} to watch list:`,
          result.error
        );
        message.channel.send(
          `Failed to start watching ${channelMention(channelId)}. Please try again.`
        );
      }
    }
  }
};
