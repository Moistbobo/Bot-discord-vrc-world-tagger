import { Message } from 'discord.js';
import { isItemInList, removeItemFromKvp } from '../../utils/jsonAsDb';
import { kvKeys } from '../../utils/jsonAsDb/types';
import logger from '../../utils/logger';
import { extractWorldIdFromMessage } from './watchForVRCWorldLinks/worldExtraction';

export const remove = async (message: Message) => {
  // Check if channel is being watched
  const isWatched = await isItemInList(
    kvKeys.WATCHED_CHANNELS,
    message.channelId
  );
  if (!isWatched) {
    return;
  }

  try {
    // Extract world ID from message
    const worldId = await extractWorldIdFromMessage(message.content);
    if (!worldId) {
      if (message.channel.isSendable()) {
        return message.channel.send(`Unable to extract worldId from input.`);
      }
      return;
    }

    const removeResult = await removeItemFromKvp(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      `${worldId}-${message.guildId}`
    );

    if (removeResult) {
      if (message.channel.isSendable()) {
        return message.channel.send(
          `Removed world ${worldId} from processed worlds. Forwarded messages will have to be manually cleaned.`
        );
      }
    } else {
      if (message.channel.isSendable()) {
        return message.channel.send(
          `Unable to remove world ${worldId} from processed worlds. Either it was not found or something went wrong.`
        );
      }
    }
  } catch (err) {
    logger.error(err);
  }
};
