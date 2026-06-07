import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms } from '../../../utils/helpers';
import {
  extractAllWorldIds,
  cleanContentForTagExtraction
} from '../../../utils/regex';
import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import { extractTags } from '../../../utils/tagExtractor';
import {
  getWorldRepository,
  type WorldRecord
} from '../../../utils/database/worldRepository';
import {
  extractWorldIdFromMessage,
  extractAllWorldIdsFromMessage
} from './worldExtraction';
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

const safeJsonStringify = (value: unknown): string =>
  JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

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

/**
 * Finds all world links in the message body, forwarded snapshots, and attachments.
 * When `scanAttachmentFilenames` is true, attachment file names are checked last.
 */
const findAllWorldMatches = async (
  message: Message,
  scanAttachmentFilenames: boolean
): Promise<WorldMatch[]> => {
  const matches: WorldMatch[] = [];
  const seen = new Set<string>();

  if (message.content) {
    logger.debug(
      `Checking direct message content: ${message.content.substring(0, 100)}...`
    );
    const fromBody = await extractAllWorldIdsFromMessage(message.content);
    for (const { worldId, sourceContent } of fromBody) {
      if (!seen.has(worldId)) {
        seen.add(worldId);
        matches.push({
          worldId,
          sourceContent,
          sourceKind: 'body'
        });
      }
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
      const fromSnapshot = await extractAllWorldIdsFromMessage(
        snapshot.content
      );
      for (const { worldId, sourceContent } of fromSnapshot) {
        if (!seen.has(worldId)) {
          seen.add(worldId);
          matches.push({
            worldId,
            sourceContent,
            sourceKind: 'snapshot'
          });
        }
      }
    }
  }

  if (scanAttachmentFilenames) {
    for (const attachment of eachAttachment(message)) {
      const ids = extractAllWorldIds(attachment.name ?? '');
      for (const worldId of ids) {
        if (!seen.has(worldId)) {
          seen.add(worldId);
          matches.push({
            worldId,
            sourceContent: attachment.name ?? worldId,
            sourceKind: 'attachment'
          });
        }
      }
    }
  }

  return matches;
};

const buildWorldProcessQueue = async (
  message: Message,
  scanAttachmentFilenames: boolean
): Promise<WorldMatch[]> => {
  return findAllWorldMatches(message, scanAttachmentFilenames);
};

/**
 * Build the combined text source for tag extraction from a Discord message
 * and any resolved external content (e.g. tweet text). This mirrors the
 * logic used in normal message processing so that crawlHistory extracts
 * tags from the same sources.
 */
export function buildTagSource(
  message: Message,
  extraSources: (string | null | undefined)[]
): string {
  const tagParts = new Set<string>();
  if (message.content) tagParts.add(message.content);
  if (message.messageSnapshots) {
    for (const [, snapshot] of message.messageSnapshots) {
      if (snapshot.content) tagParts.add(snapshot.content);
    }
  }
  for (const source of extraSources) {
    if (source) tagParts.add(source);
  }
  return cleanContentForTagExtraction(Array.from(tagParts).join('\n'));
}

/**
 * Processes a world ID: fetches data, extracts tags, upserts to repository,
 * creates embed, sends the bot reply, then forwards it.
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

  const tagSource = buildTagSource(message, [sourceContent]);
  const tags = extractTags(tagSource);

  const record: WorldRecord = {
    worldId,
    guildId: message.guildId ?? '',
    messageId: message.id,
    name: worldData.name,
    authorName: worldData.authorName,
    capacity: worldData.capacity,
    platforms: supportedPlatforms,
    tags,
    imageUrl: worldData.imageUrl,
    sourceContent,
    vrchatData: safeJsonStringify(worldData)
  };

  getWorldRepository().upsert(record);
  logger.info(
    `Saved world ${worldId} to repository with tags: ${tags.join(', ') || 'none'}`
  );

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

  const responseMsg = await sendResponse(message, embed);

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
