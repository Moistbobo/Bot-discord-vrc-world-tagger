import { Message } from 'discord.js';
import { add, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import logger from '../../utils/logger';

export const ignoreMe = async (message: Message): Promise<void> => {
  const authorId = message.author.id;

  if (await has(kvKeys.IGNORED_USERS, authorId)) {
    if (message.channel.isSendable()) {
      await message.channel.send('You are already on the ignore list.');
    }
    return;
  }

  const { success, error } = await add(kvKeys.IGNORED_USERS, authorId, false);
  if (!success) {
    logger.error(`Failed to add user ${authorId} to ignore list:`, error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Could not update the ignore list. Please try again later.'
      );
    }
    return;
  }

  logger.info(`User ${authorId} added themselves to the ignore list`);
  if (message.channel.isSendable()) {
    await message.channel.send(
      'You are now on the ignore list. This bot will not process your messages or reactions. Send `.unignoreMe` to opt back in.'
    );
  }
};
