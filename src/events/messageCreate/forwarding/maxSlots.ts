import { channelMention, Message } from 'discord.js';
import logger from '../../../utils/logger';
import { replaceListWithItem } from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';

const maxSlots = async (message: Message) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a target forwarding channel.');
      return message.channel.send('Please tag a channel to forward to.');
    }
  }

  const channelId = firstMentionedChannel.id;

  logger.info(
    `Saving ${channelId} as ${kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL}`
  );
  if (message.channel.isSendable()) {
    message.channel.send(
      `Saving ${channelMention(channelId)} as ${kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL}`
    );
  }
  await replaceListWithItem(kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL, channelId);
};

export default maxSlots;
