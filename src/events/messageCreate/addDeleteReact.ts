import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { add } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

const addDeleteReact = async (message: Message) => {
  const parts = message.content.trim().split(/\s+/);
  const emoji = parts[1];

  if (!emoji) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Please provide an emoji. Usage: `.addDeleteReact <emoji>`'
      );
    }
    return;
  }

  try {
    const result = await add(kvKeys.REACT_TO_DELETE_EMOJIS, emoji, true);

    if (!result.success) {
      throw new Error(result.error || 'Failed to persist');
    }

    if (message.channel.isSendable()) {
      await message.channel.send(
        `Saved "${emoji}". In \`.watchReacts\` channels, reacting on the bot's messages with this emoji deletes them. If this emoji is also used for \`.forwardReact\`, the bot forwards first and deletes only after that forward is recorded.`
      );
    }
  } catch (error) {
    logger.error('Failed to add react-to-delete emoji:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to save the react-to-delete emoji. Please try again.'
      );
    }
  }
};

export default addDeleteReact;
