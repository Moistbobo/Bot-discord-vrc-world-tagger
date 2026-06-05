import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { isApiServerRunning, stopApiServer } from '../../apiServer';

const apiStop = async (message: Message) => {
  if (!isApiServerRunning()) {
    if (message.channel.isSendable()) {
      await message.channel.send('⚠️ The API server is not currently running.');
    }
    return;
  }

  try {
    await stopApiServer();
    if (message.channel.isSendable()) {
      await message.channel.send('🛑 API server stopped.');
    }
    logger.info(`API server stopped by ${message.author.tag}`);
  } catch (error) {
    logger.error('Failed to stop API server via command:', error);
    if (message.channel.isSendable()) {
      await message.channel.send('❌ Failed to stop the API server.');
    }
  }
};

export default apiStop;
