import { Message } from 'discord.js';
import Config from '../../../config';
import logger from '../../../utils/logger';

type MessageHandler = (message: Message) => Promise<void> | void;

const withProtection = (fn: MessageHandler): MessageHandler => {
  return async (message: Message): Promise<void> => {
    try {
      const authorId = message.author.id;

      if (!Config.ADMIN_ID.includes(authorId)) {
        logger.info(
          `User ${authorId} attempted to access protected command: ${message.content}`
        );
        return;
      }

      await fn(message);
    } catch (error) {
      logger.error('Error in protected command:', error);
    }
  };
};

export default withProtection;
