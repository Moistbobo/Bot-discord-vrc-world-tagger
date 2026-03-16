import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { get, set } from '../../../utils/jsonAsDb';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

const removeReact = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);
  const arg = parts[1];

  if (!arg) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please provide an emoji or index to remove. Usage: `.removeReact <emoji or index>` (e.g. `.removeReact 😀` or `.removeReact 1`)'
      );
    }
    return;
  }

  try {
    const config =
      (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) ||
      {};
    const entries = Object.entries(config);

    let emojiToRemove: string;
    let removedByIndex: number | undefined;

    if (arg in config) {
      emojiToRemove = arg;
    } else if (/^\d+$/.test(arg)) {
      const index = parseInt(arg, 10);
      if (index < 1 || index > entries.length) {
        if (message.channel.isSendable()) {
          await message.channel.send(
            `No forwarding at index ${index}. Use \`.listReacts\` to see valid indices (1–${entries.length || 0}).`
          );
        }
        return;
      }
      emojiToRemove = entries[index - 1][0];
      removedByIndex = index;
    } else {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `No forwarding is configured for "${arg}". Nothing to remove.`
        );
      }
      return;
    }

    const updatedConfig = Object.fromEntries(
      entries.filter(([emoji]) => emoji !== emojiToRemove)
    );
    const success = await set<ReactionForwardConfig>(
      kvKeys.REACTION_FORWARD_CHANNELS,
      updatedConfig
    );

    if (!success) {
      throw new Error('Failed to persist reaction forward configuration');
    }

    if (message.channel.isSendable()) {
      const msg =
        removedByIndex !== undefined
          ? `Removed reaction forwarding for "${emojiToRemove}" (index ${removedByIndex}).`
          : `Removed reaction forwarding for "${emojiToRemove}".`;
      await message.channel.send(msg);
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
