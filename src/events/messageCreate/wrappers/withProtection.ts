import { Message } from 'discord.js';
import Config from '../../../assets/config';
import logger from '../../../utils/logger';

type MessageHandler = (message: Message) => Promise<void | Message>;

const withProtection = (fn: MessageHandler): MessageHandler => {
  return async (message: Message): Promise<void | Message> => {
    try {
      const authorId = message.author.id;

      if (!Config.ADMIN_ID.includes(authorId)) {
        logger.info(
          `User ${authorId} attempted to access protected command: ${message.content}`
        );
        return;
      }

      return await fn(message);
    } catch (error) {
      logger.error('Error in protected command:', error);
    }
  };
};

export default withProtection;
