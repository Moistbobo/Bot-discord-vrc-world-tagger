import { Message } from 'discord.js';
import { wipeValuesForKey } from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import logger from '../../../utils/logger';

const clearForwardingChannels = async (message: Message) => {
  try {
    const results = await Promise.all([
      wipeValuesForKey(kvKeys.ANDROID_FORWARDING_CHANNEL),
      wipeValuesForKey(kvKeys.PLAYER_COUNT_FORWARDING_CHANNEL)
    ]);

    const allSuccessful = results.every(result => result.success);
    
    if (message.channel.isSendable()) {
      if (allSuccessful) {
        logger.info(
          `Forwarding channels cleared by ${message.author.displayName}`
        );
        message.channel.send('Cleared all forwarding channels.');
      } else {
        logger.error('Failed to clear some forwarding channels:', results);
        message.channel.send('Failed to clear some forwarding channels. Please try again.');
      }
    }
  } catch (err) {
    logger.error('Unexpected error clearing forwarding channels:', err);
    if (message.channel.isSendable()) {
      message.channel.send('An unexpected error occurred while clearing forwarding channels.');
    }
  }
};

export default clearForwardingChannels;
