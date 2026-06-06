import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { isApiServerRunning, startApiServer } from '../../apiServer';

const apiStart = async (message: Message) => {
  if (isApiServerRunning()) {
    if (message.channel.isSendable()) {
      await message.channel.send('⚠️ The API server is already running.');
    }
    return;
  }

  try {
    await startApiServer();
    if (message.channel.isSendable()) {
      await message.channel.send('✅ API server started.');
    }
    logger.info(`API server started by ${message.author.tag}`);
  } catch (error) {
    logger.error('Failed to start API server via command:', error);
    if (message.channel.isSendable()) {
      await message.channel.send('❌ Failed to start the API server.');
    }
  }
};

export default apiStart;
