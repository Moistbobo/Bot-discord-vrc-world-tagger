import { channelMention, Message } from 'discord.js';
import logger from '../../utils/logger';
import { add, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

export const watchReacts = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a channel to watch for reactions.');
      return message.channel.send(
        'Please tag a channel to watch for reaction forwarding.'
      );
    }
    return;
  }

  const channelId = firstMentionedChannel.id;

  const isAlreadyWatched = await has(
    kvKeys.WATCHED_REACTION_CHANNELS,
    channelId
  );

  if (isAlreadyWatched) {
    logger.error(
      `Channel ID ${channelId} is already being watched for reaction forwarding.`
    );
    if (message.channel.isSendable()) {
      message.channel.send(
        `${channelMention(channelId)} is already being watched for reaction forwarding.`
      );
    }
  } else {
    const result = await add(kvKeys.WATCHED_REACTION_CHANNELS, channelId);

    if (message.channel.isSendable()) {
      if (result.success) {
        message.channel.send(
          `Now watching ${channelMention(channelId)} for reaction forwarding.`
        );
      } else {
        logger.error(
          `Failed to add channel ${channelId} to reaction watch list:`,
          result.error
        );
        message.channel.send(
          `Failed to start watching ${channelMention(channelId)} for reaction forwarding. Please try again.`
        );
      }
    }
  }
};
