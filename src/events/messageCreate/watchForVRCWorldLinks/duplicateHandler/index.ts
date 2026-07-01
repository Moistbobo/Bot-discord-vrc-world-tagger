import { Message } from 'discord.js';
import logger from '../../../../utils/logger';
import { getWorldRepository } from '../../../../utils/database/worldRepository';
import { emojiMap } from '../../../../assets/media';

/**
 * Checks if a world has already been processed and handles duplicate responses.
 * Queries the SQLite repository instead of the legacy JSON KVP store.
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
  const guildId = message.guildId;
  if (!guildId) {
    return false;
  }

  const repo = getWorldRepository();
  const existing = repo.getByWorldAndGuild(worldId, guildId);

  if (existing) {
    logger.info(
      `World id ${worldId} has already been shared, retrieving original message id...`
    );

    const originalMessageId = existing.messageId;
    const channelId = message.channelId;

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
        await message.reply({
          allowedMentions: { repliedUser: false },
          content: `${emojiMap.actually} Uhm Ackhusally this is a duplicate of ${originalMessageLink}\n-# Press the ${emojiMap.recycle} reaction to fetch world information anyway.`
        });
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

  return false; // World is new — caller will upsert via repository
};
