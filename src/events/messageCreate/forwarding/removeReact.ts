import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { get, set } from '../../../utils/jsonAsDb';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

const removeReact = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);
  const emoji = parts[1];

  if (!emoji) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please provide an emoji to remove. Usage: `.removeReact 😀`'
      );
    }
    return;
  }

  try {
    const config =
      (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) ||
      {};

    if (!(emoji in config)) {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `No forwarding is configured for "${emoji}". Nothing to remove.`
        );
      }
      return;
    }

    const { ...updatedConfig } = config;
    const success = await set<ReactionForwardConfig>(
      kvKeys.REACTION_FORWARD_CHANNELS,
      updatedConfig
    );

    if (!success) {
      throw new Error('Failed to persist reaction forward configuration');
    }

    if (message.channel.isSendable()) {
      await message.channel.send(`Removed reaction forwarding for "${emoji}".`);
    }
  } catch (error) {
    logger.error('Failed to remove reaction forwarding configuration:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to remove the reaction forwarding configuration. Please try again.'
      );
    }
  }
};

export default removeReact;
