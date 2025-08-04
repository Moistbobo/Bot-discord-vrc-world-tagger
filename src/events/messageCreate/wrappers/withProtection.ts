import logger from '../../../utils/logger';
import { Message } from 'discord.js';
import Config from '../../../config';

const withProtection = (fn) => {
  return async (message: Message) => {
    try {
      const authorId = message.author.id;

      if (!Config.ADMIN_ID.includes(authorId)) {
        logger.info(
          `User attempted to access protected command with content: ${message.content}`
        );

        return;
      }

      // Call the original function
      await fn(message);
    } catch (error) {
      logger.error(`An error occurred: ${error.message}`);
    }
  };
};

export default withProtection;
