import { channelMention, Message } from 'discord.js';
import logger from '../../../utils/logger';
import { get, set } from '../../../utils/jsonAsDb';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

const forwardReact = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);

  const emoji = parts[1];
  const firstMentionedChannel = message.mentions.channels.first();

  if (!emoji || !firstMentionedChannel) {
    if (message.channel.isSendable()) {
      logger.error(
        'User did not specify a valid emoji and target forwarding channel.'
      );
      await message.channel.send(
        'Please provide an emoji and tag a channel to forward to. Usage: `.forwardReact 😀 #channel`'
      );
    }
    return;
  }

  const channelId = firstMentionedChannel.id;

  try {
    const existingConfig =
      (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) ||
      {};

    const updatedConfig: ReactionForwardConfig = {
      ...existingConfig,
      [emoji]: channelId
    };

    const success = await set<ReactionForwardConfig>(
      kvKeys.REACTION_FORWARD_CHANNELS,
      updatedConfig
    );

    if (!success) {
      throw new Error('Failed to persist reaction forward configuration');
    }

    if (message.channel.isSendable()) {
      await message.channel.send(
        `Saving reactions with "${emoji}" to be forwarded to ${channelMention(
          channelId
        )}.`
      );
    }
  } catch (error) {
    logger.error('Failed to save reaction forwarding configuration:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to save the reaction forwarding configuration. Please try again.'
      );
    }
  }
};

export default forwardReact;
