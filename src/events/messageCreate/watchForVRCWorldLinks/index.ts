import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms, getWorldNameId } from '../../../utils/helpers';
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
 * Main function to watch for VRC world links and process them
 */
const watchForVRCWorldLinks = async (message: Message): Promise<void> => {
  // Check if channel is being watched
  const isWatched = await has(kvKeys.WATCHED_CHANNELS, message.channelId);
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

    // Check if world is a duplicate and handle accordingly
    if (!Config.DEV_MODE) {
      const isDuplicate = await checkAndHandleDuplicate(message, worldId);
      if (isDuplicate) {
        return;
      }
    }

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
  } catch (error) {
    logger.error('Error processing VRC world link:', error);
  }
};

export default watchForVRCWorldLinks;
