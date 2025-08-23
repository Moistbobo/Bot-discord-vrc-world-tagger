import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms } from '../../../utils/helpers';
import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import { extractWorldIdFromMessage } from './worldExtraction';
import { fetchWorldData, calculatePackageSizes } from './worldData';
import { createWorldEmbed } from './embedBuilder';
import {
  getForwardingChannels,
  forwardToChannel,
  sendResponse
} from './forwarding';
import { checkAndHandleDuplicate } from './duplicateHandler';
import Config from '../../../assets/config';

/**
 * Extracts content from a message, handling both regular and forwarded messages
 * @param message - The Discord message to extract content from
 * @returns Array of content strings to check for VRChat world links
 */
const extractMessageContent = (message: Message): string[] => {
  const contentArray: string[] = [];

  // Add the current message content
  if (message.content) {
    contentArray.push(message.content);
    logger.debug(
      `Added current message content: ${message.content.substring(0, 100)}...`
    );
  }

  // Add content from forwarded message snapshots
  if (message.messageSnapshots && message.messageSnapshots.size > 0) {
    logger.debug(
      `Found ${message.messageSnapshots.size} forwarded message snapshots`
    );
    for (const [, snapshot] of message.messageSnapshots) {
      if (snapshot.content) {
        contentArray.push(snapshot.content);
        logger.debug(
          `Added forwarded message content: ${snapshot.content.substring(0, 100)}...`
        );
      }
    }
  }

  logger.debug(`Total content entries to check: ${contentArray.length}`);
  return contentArray;
};

/**
 * Main function to watch for VRC world links and process them
 *
 * This function now handles both direct messages and forwarded messages.
 * When a message is forwarded, it extracts content from messageSnapshots
 * to process VRChat world links that may be contained in the original message.
 */
const watchForVRCWorldLinks = async (message: Message): Promise<void> => {
  // Check if channel is being watched
  const isWatched = await has(kvKeys.WATCHED_CHANNELS, message.channelId);
  if (!isWatched) {
    return;
  }

  try {
    // Extract content from both current message and forwarded messages
    const contentArray = extractMessageContent(message);

    // Try to find a world ID in any of the content
    let worldId: string | null = null;
    let sourceContent = '';

    for (const content of contentArray) {
      const extractedWorldId = await extractWorldIdFromMessage(content);
      if (extractedWorldId) {
        worldId = extractedWorldId;
        sourceContent = content;
        break;
      }
    }

    if (!worldId) {
      return;
    }

    logger.info(
      `Processing VRC World link: ${worldId} from ${
        message.messageSnapshots?.size > 0
          ? 'forwarded message'
          : 'direct message'
      }`
    );

    // Check if world is a duplicate and handle accordingly
    if (!Config.DEV_MODE) {
      const isDuplicate = await checkAndHandleDuplicate(message, worldId);
      if (isDuplicate) {
        return;
      }
    }

    // Fetch world data
    const worldData = await fetchWorldData(worldId);

    // Get supported platforms and calculate package sizes
    const supportedPlatforms = getSupportedPlatforms(worldData.unityPackages);
    const packageSizes = await calculatePackageSizes(worldData);

    // Create embed using the source content (either current message or forwarded content)
    const embed = createWorldEmbed(
      worldData,
      worldId,
      supportedPlatforms,
      packageSizes,
      sourceContent || message.content
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
  } catch (error) {
    logger.error('Error processing VRC world link:', error);
  }
};

export default watchForVRCWorldLinks;
