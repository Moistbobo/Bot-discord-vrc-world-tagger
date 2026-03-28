import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { getAll, remove } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const removeDeleteReact = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);
  const arg = parts[1];

  if (!arg) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please provide an emoji or index to remove. Usage: `.removeDeleteReact <emoji or index>` (e.g. `.removeDeleteReact 😀` or `.removeDeleteReact 1`)'
      );
    }
    return;
  }

  try {
    const items = await getAll(kvKeys.REACT_TO_DELETE_EMOJIS);

    let emojiToRemove: string;
    let removedByIndex: number | undefined;

    if (items.includes(arg)) {
      emojiToRemove = arg;
    } else if (/^\d+$/.test(arg)) {
      const index = parseInt(arg, 10);
      if (index < 1 || index > items.length) {
        if (message.channel.isSendable()) {
          await message.channel.send(
            `No react-to-delete entry at index ${index}. Use \`.listReacts\` to see valid indices (1–${items.length || 0}).`
          );
        }
        return;
      }
      emojiToRemove = items[index - 1];
      removedByIndex = index;
    } else {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `No react-to-delete entry for "${arg}". Nothing to remove.`
        );
      }
      return;
    }

    const result = await remove(kvKeys.REACT_TO_DELETE_EMOJIS, emojiToRemove);

    if (!result.success) {
      throw new Error(result.error || 'Failed to persist');
    }

    if (message.channel.isSendable()) {
      const msg =
        removedByIndex !== undefined
          ? `Removed react-to-delete for "${emojiToRemove}" (index ${removedByIndex}).`
          : `Removed react-to-delete for "${emojiToRemove}".`;
      await message.channel.send(msg);
    }
  } catch (error) {
    logger.error('Failed to remove react-to-delete emoji:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to remove the react-to-delete emoji. Please try again.'
      );
    }
  }
};

export default removeDeleteReact;
