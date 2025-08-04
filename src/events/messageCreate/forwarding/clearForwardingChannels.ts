import { Message } from 'discord.js';
import { wipeValuesForKey } from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import logger from '../../../utils/logger';

const clearForwardingChannels = async (message: Message) => {
  try {
    await Promise.all([
      wipeValuesForKey(kvKeys.ANDROID_FORWARDING_CHANNEL),
      wipeValuesForKey(kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL)
    ]);

    if (message.channel.isSendable()) {
      logger.info(
        `Forwarding channels cleared by ${message.author.displayName}`
      );
      message.channel.send('Cleared all forwarding channels.');
    }
  } catch (err) {
    logger.error(err);
  }
};

export default clearForwardingChannels;
