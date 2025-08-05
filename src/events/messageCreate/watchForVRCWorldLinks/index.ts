import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms, getWorldNameId } from '../../../utils/helpers';
import {
  getKvp,
  isItemInList,
  saveKvp
} from '../../../utils/jsonAsDb/getSetValue';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import {
  extractWorldIdFromMessage,
  fetchWorldData,
  calculatePackageSizes,
  createWorldEmbed,
  getForwardingChannels,
  forwardToChannel,
  sendResponse
} from './util';
import { emojiMap } from '../../../assets/icons';

/**
 * Main function to watch for VRC world links and process them
 */
const watchForVRCWorldLinks = async (message: Message): Promise<void> => {
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
      return;
    }

    logger.info(`Processing VRC World link: ${worldId}`);

    // Check if world has already been processed and generate original message link if so
    const originalMessageId = await getKvp(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      worldId
    );
    if (originalMessageId) {
      logger.info(
        `World id ${worldId} has already been shared, retreiving original message id...`
      );
      // Try to get the channelId from the current message
      const channelId = message.channelId;
      const guildId = message.guildId;
      if (guildId && channelId) {
        const originalMessageLink = `https://discord.com/channels/${guildId}/${channelId}/${originalMessageId}`;
        // React to the original message with a recycle emoji
        try {
          await message.react('♻️');
        } catch (err) {
          logger.warn(`Failed to react with recycle emoji: ${err}`);
        }

        if (message.channel.isSendable()) {
          message.channel.send(
            `${emojiMap.actually} Uhm Ackhusally this is a duplicate of ${originalMessageLink}`
          );
        } else {
          logger.warn(
            `Message channel is not sendable, skipping original message link for world ${worldId}`
          );
        }
        return;
      }
    } else {
      await saveKvp(
        kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
        worldId,
        message.id
      );

      logger.info(
        `Saving original message ID for world ${worldId}: ${message.id}`
      );

      // Fetch world data
      const worldData = await fetchWorldData(worldId);
      logger.info(`Retrieved world info: ${getWorldNameId(worldData)}`);

      // Get supported platforms and calculate package sizes
      const supportedPlatforms = getSupportedPlatforms(worldData.unityPackages);
      const packageSizes = await calculatePackageSizes(worldData);

      // Create embed
      const embed = createWorldEmbed(
        worldData,
        worldId,
        supportedPlatforms,
        packageSizes,
        message.content
      );

      // Get forwarding channels and forward to them
      const forwardingChannels = await getForwardingChannels(
        worldData,
        supportedPlatforms
      );

      for (const channel of forwardingChannels) {
        await forwardToChannel(
          message,
          channel.id,
          channel.tag,
          embed,
          worldData.id
        );
      }

      // Send response to original message
      await sendResponse(message, embed, worldData.id);
    }
  } catch (error) {
    logger.error('Error processing VRC world link:', error);
  }
};

export default watchForVRCWorldLinks;
