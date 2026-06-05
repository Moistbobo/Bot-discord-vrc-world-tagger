import { Message } from 'discord.js';
import { has, remove } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import logger from '../../utils/logger';

export const unignoreMe = async (message: Message): Promise<void> => {
  const authorId = message.author.id;

  if (!(await has(kvKeys.IGNORED_USERS, authorId))) {
    if (message.channel.isSendable()) {
      await message.channel.send('You are not on the ignore list.');
    }
    return;
  }

  const { success, error } = await remove(kvKeys.IGNORED_USERS, authorId);
  if (!success) {
    logger.error(`Failed to remove user ${authorId} from ignore list:`, error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Could not update the ignore list. Please try again later.'
      );
    }
    return;
  }

  logger.info(`User ${authorId} removed themselves from the ignore list`);
  if (message.channel.isSendable()) {
    await message.channel.send(
      'You have been removed from the ignore list. This bot will process your messages and reactions again.'
    );
  }
};
