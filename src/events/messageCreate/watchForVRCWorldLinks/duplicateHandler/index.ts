import { Message } from 'discord.js';
import logger from '../../../../utils/logger';
import {
  getValue,
  setValue
} from '../../../../utils/jsonAsDb/handlers/persistentKvp';
import { kvKeys } from '../../../../utils/jsonAsDb/types';
import { emojiMap } from '../../../../assets/icons';

/**
 * Checks if a world has already been processed and handles duplicate responses
 * @param message - The Discord message
 * @param worldId - The world ID to check
 * @param silent - If true, suppresses user-facing messages and reactions (default: false)
 * @returns Promise resolving to true if world is a duplicate, false if new
 */
export const checkAndHandleDuplicate = async (
  message: Message,
  worldId: string,
  silent: boolean = false
): Promise<boolean> => {
  // Check if world has already been processed and generate original message link if so
  const originalMessageId = await getValue(
    kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
    `${worldId}-${message.guildId}`
  );

  if (originalMessageId) {
    logger.info(
      `World id ${worldId} has already been shared, retrieving original message id...`
    );

    // Try to get the channelId from the current message
    const channelId = message.channelId;
    const guildId = message.guildId;

    if (guildId && channelId) {
      const originalMessageLink = `https://discord.com/channels/${guildId}/${channelId}/${originalMessageId}`;

      // Only show user-facing responses if not in silent mode
      if (!silent) {
        // React to the original message with a recycle emoji
        try {
          await message.react(emojiMap.recycle);
        } catch (err) {
          logger.warn(`Failed to react with recycle emoji: ${err}`);
        }

        if (message.channel.isSendable()) {
          await message.channel.send(
            `${emojiMap.actually} Uhm Ackhusally this is a duplicate of ${originalMessageLink}`
          );
        } else {
          logger.warn(
            `Message channel is not sendable, skipping original message link for world ${worldId}`
          );
        }
      } else {
        // Log silently for crawl operations
        logger.debug(
          `Silent duplicate detection: World ${worldId} is a duplicate of message ${originalMessageId}`
        );
      }
      return true; // World is a duplicate
    }
  } else {
    // Save the original message ID for this world
    await setValue(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      `${worldId}-${message.guildId}`,
      message.id
    );

    logger.info(
      `Saving original message ID for world ${worldId}-${message.guildId}: ${message.id}`
    );
  }

  return false; // World is new
};
