import { Message } from 'discord.js';
import { isValidVRCWorldLink } from '../utils/isValidVRCWorldLink';
import logger from '../utils/logger';

const messageCreate = (message: Message) => {
  // check that message content contains only 1 vrchat world link
  if (!isValidVRCWorldLink(message.content)) return;

  logger.info(`${message.content} detected as valid VRC World link`);

  message.react('✅');
};

export default messageCreate;
