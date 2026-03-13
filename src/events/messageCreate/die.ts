import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { images } from '../../assets/media';

const die = async (message: Message) => {
  if (message.channel.isSendable()) {
    await message.channel.send(images.thankuforevaURL);

    logger.info(`.die command received. Thank you forever.`);
    process.exit(0);
  }
};

export default die;
