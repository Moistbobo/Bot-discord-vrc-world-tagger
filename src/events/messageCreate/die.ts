import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { images } from '../../assets/media';
import { stopApiServer } from '../../apiServer';

const die = async (message: Message) => {
  if (message.channel.isSendable()) {
    await message.channel.send(images.thankuforevaURL);

    logger.info(`.die command received. Thank you forever.`);
    await stopApiServer();
    process.exit(0);
  }
};

export default die;
