import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms } from '../../../utils/helpers';
import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import {
  getValue,
  setValue
} from '../../../utils/jsonAsDb/handlers/persistentKvp';
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
 * Finds a world link in the message body first, then in forwarded snapshots.
 * `fromDirectUserContent` is true only when the match came from `message.content`, not snapshots.
 */
const findFirstWorldMatch = async (
  message: Message
): Promise<{
  worldId: string;
  sourceContent: string;
  fromDirectUserContent: boolean;
} | null> => {
  if (message.content) {
    logger.debug(
      `Checking direct message content: ${message.content.substring(0, 100)}...`
    );
    const fromBody = await extractWorldIdFromMessage(message.content);
    if (fromBody) {
      return {
        worldId: fromBody,
        sourceContent: message.content,
        fromDirectUserContent: true
      };
    }
  }

  if (message.messageSnapshots && message.messageSnapshots.size > 0) {
    logger.debug(
      `Found ${message.messageSnapshots.size} forwarded message snapshots`
    );
    for (const [, snapshot] of message.messageSnapshots) {
      if (!snapshot.content) continue;
      logger.debug(
        `Checking forwarded snapshot content: ${snapshot.content.substring(0, 100)}...`
      );
      const fromSnapshot = await extractWorldIdFromMessage(snapshot.content);
      if (fromSnapshot) {
        return {
          worldId: fromSnapshot,
          sourceContent: snapshot.content,
          fromDirectUserContent: false
        };
      }
    }
  }

  return null;
};

/**
 * Processes a world ID: fetches data, creates embed, sends the bot reply, then forwards it.
 */
const processWorldId = async (
  message: Message,
  worldId: string,
  sourceContent: string,
  options?: {
    skipDuplicateCheck?: boolean;
    reactWithUndoOnReply?: boolean;
  }
): Promise<void> => {
  const skipDuplicateCheck = options?.skipDuplicateCheck ?? false;
  const reactWithUndoOnReply = options?.reactWithUndoOnReply ?? false;

  if (!skipDuplicateCheck && !Config.DEV_MODE) {
    const isDuplicate = await checkAndHandleDuplicate(message, worldId);
    if (isDuplicate) {
      return;
    }
  }

  const worldData = await fetchWorldData(worldId);
  const supportedPlatforms = getSupportedPlatforms(worldData.unityPackages);
  const packageSizes = await calculatePackageSizes(worldData);

  const embed = createWorldEmbed(
    worldData,
    worldId,
    supportedPlatforms,
    packageSizes,
    sourceContent || message.content
  );

  const forwardingChannels = await getForwardingChannels(
    worldData,
    supportedPlatforms
  );

  const responseMsg = await sendResponse(message, embed, worldData.id, {
    reactWithUndo: reactWithUndoOnReply
  });

  if (responseMsg) {
    for (const channel of forwardingChannels) {
      await forwardToChannel(
        responseMsg,
        channel.id,
        channel.tag,
        embed,
        worldData.id
      );
    }
  }
};

export const forceRefetchWorldFromMessage = async (
  message: Message
): Promise<boolean> => {
  const match = await findFirstWorldMatch(message);
  if (!match) return false;
  const { worldId, sourceContent, fromDirectUserContent } = match;

  const guildId = message.guildId;
  if (guildId) {
    const kvpKey = `${worldId}-${guildId}`;
    const existingOriginal = await getValue(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      kvpKey
    );
    if (!existingOriginal) {
      await setValue(
        kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
        kvpKey,
        message.id
      );
      logger.info(
        `Saving original message ID for world ${kvpKey} (force refetch): ${message.id}`
      );
    }
  }

  await processWorldId(message, worldId, sourceContent, {
    skipDuplicateCheck: true,
    reactWithUndoOnReply: fromDirectUserContent
  });
  return true;
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
    const match = await findFirstWorldMatch(message);
    if (!match) {
      return;
    }

    const { worldId, sourceContent, fromDirectUserContent } = match;

    logger.info(
      `Processing VRC World link: ${worldId} from ${
        fromDirectUserContent ? 'direct message' : 'forwarded message'
      }`
    );

    await processWorldId(message, worldId, sourceContent, {
      reactWithUndoOnReply: fromDirectUserContent
    });
  } catch (error) {
    logger.error('Error processing VRC world link:', error);
  }
};

export default watchForVRCWorldLinks;
