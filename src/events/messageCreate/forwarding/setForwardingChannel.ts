import { channelMention, Message } from 'discord.js';
import logger from '../../../utils/logger';
import { replace } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ForwardingChannelType = 'android' | 'playerCount' | 'lowCapacity';

const forwardingChannelConfig = {
  android: {
    key: kvKeys.ANDROID_FORWARDING_CHANNEL,
    displayName: 'Android forwarding channel',
    logPrefix: 'Android'
  },
  playerCount: {
    key: kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL,
    displayName: 'player count forwarding channel',
    logPrefix: 'Player count'
  },
  lowCapacity: {
    key: kvKeys.LOW_CAPACITY_FORWARDING_CHANNEL,
    displayName: 'low capacity forwarding channel',
    logPrefix: 'Low Capacity'
  }
} as const;

const setForwardingChannel = async (
  message: Message,
  channelType: ForwardingChannelType
) => {
  const firstMentionedChannel = message.mentions.channels.first();

  if (!firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error('User did not specify a target forwarding channel.');
      return message.channel.send('Please tag a channel to forward to.');
    }
  }

  const channelId = firstMentionedChannel.id;
  const config = forwardingChannelConfig[channelType];

  logger.info(`Saving ${channelId} as ${config.key}`);

  const result = await replace(config.key, channelId);

  if (message.channel.isSendable()) {
    if (result.success) {
      message.channel.send(
        `Saving ${channelMention(channelId)} as ${config.displayName}`
      );
    } else {
      logger.error(
        `Failed to save ${config.logPrefix} forwarding channel ${channelId}:`,
        result.error
      );
      message.channel.send(
        `Failed to save ${channelMention(channelId)} as ${config.displayName}. Please try again.`
      );
    }
  }
};

export default setForwardingChannel;
