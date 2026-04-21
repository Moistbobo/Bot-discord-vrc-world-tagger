import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms } from '../../../utils/helpers';
import { extractAllWorldIds } from '../../../utils/regex';
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

type WorldMatchSource = 'body' | 'snapshot' | 'attachment';

type WorldMatch = {
  worldId: string;
  sourceContent: string;
  sourceKind: WorldMatchSource;
};

const eachAttachment = (message: Message) =>
  message.attachments?.values() ?? [][Symbol.iterator]();

const attachmentWorldIdsInOrder = (message: Message): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const attachment of eachAttachment(message)) {
    for (const id of extractAllWorldIds(attachment.name ?? '')) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
};

const attachmentDisplayNameForWorldId = (
  message: Message,
  worldId: string
): string => {
  for (const attachment of eachAttachment(message)) {
    if (extractAllWorldIds(attachment.name ?? '').includes(worldId)) {
      return attachment.name ?? worldId;
    }
  }
  return worldId;
};

/**
 * Finds a world link in the message body first, then in forwarded snapshots.
 * When `scanAttachmentFilenames` is true, attachment file names are checked last
 * (only use in watched channels — see `watchForVRCWorldLinks` / `forceRefetchWorldFromMessage`).
 */
const findFirstWorldMatch = async (
  message: Message,
  scanAttachmentFilenames: boolean
): Promise<WorldMatch | null> => {
  if (message.content) {
    logger.debug(
      `Checking direct message content: ${message.content.substring(0, 100)}...`
    );
    const fromBody = await extractWorldIdFromMessage(message.content);
    if (fromBody) {
      return {
        worldId: fromBody,
        sourceContent: message.content,
        sourceKind: 'body'
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
          sourceKind: 'snapshot'
        };
      }
    }
  }

  if (scanAttachmentFilenames) {
    for (const attachment of eachAttachment(message)) {
      const ids = extractAllWorldIds(attachment.name ?? '');
      if (ids.length > 0) {
        return {
          worldId: ids[0],
          sourceContent: attachment.name ?? ids[0],
          sourceKind: 'attachment'
        };
      }
    }
  }

  return null;
};

const buildWorldProcessQueue = async (
  message: Message,
  scanAttachmentFilenames: boolean
): Promise<WorldMatch[]> => {
  const primary = await findFirstWorldMatch(message, scanAttachmentFilenames);
  const fromFilenames = scanAttachmentFilenames
    ? attachmentWorldIdsInOrder(message)
    : [];
  const seen = new Set<string>();
  const queue: WorldMatch[] = [];

  if (primary) {
    queue.push(primary);
    seen.add(primary.worldId);
  }

  for (const worldId of fromFilenames) {
    if (!seen.has(worldId)) {
      seen.add(worldId);
      queue.push({
        worldId,
        sourceContent: attachmentDisplayNameForWorldId(message, worldId),
        sourceKind: 'attachment'
      });
    }
  }

  return queue;
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
  }
): Promise<void> => {
  const skipDuplicateCheck = options?.skipDuplicateCheck ?? false;

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

  const responseMsg = await sendResponse(message, embed, worldData.id);

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

const sourceKindLogLabel = (kind: WorldMatchSource): string => {
  switch (kind) {
    case 'body':
      return 'direct message';
    case 'snapshot':
      return 'forwarded message';
    case 'attachment':
      return 'attachment filename';
  }
};

export const forceRefetchWorldFromMessage = async (
  message: Message
): Promise<boolean> => {
  const isWatched = await has(kvKeys.WATCHED_CHANNELS, message.channelId);
  if (!isWatched) {
    return false;
  }

  const match = await findFirstWorldMatch(message, true);
  if (!match) return false;
  const { worldId, sourceContent } = match;

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
    skipDuplicateCheck: true
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
    const queue = await buildWorldProcessQueue(message, true);
    if (queue.length === 0) {
      return;
    }

    for (const match of queue) {
      logger.info(
        `Processing VRC World link: ${match.worldId} from ${sourceKindLogLabel(match.sourceKind)}`
      );
      await processWorldId(message, match.worldId, match.sourceContent);
    }
  } catch (error) {
    logger.error('Error processing VRC world link:', error);
  }
};

export default watchForVRCWorldLinks;
