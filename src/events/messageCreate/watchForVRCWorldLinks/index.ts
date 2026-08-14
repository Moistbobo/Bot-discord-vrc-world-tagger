import { Message } from 'discord.js';
import logger from '../../../utils/logger';
import { getSupportedPlatforms } from '../../../utils/helpers';
import {
  extractAllWorldIds,
  cleanContentForTagExtraction
} from '../../../utils/regex';
import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';
import { api } from '../../../utils/apiClient';
import {
  extractWorldIdFromMessage,
  extractAllWorldIdsFromMessage
} from './worldExtraction';
import { createWorldEmbed } from './embedBuilder';
import {
  getForwardingChannels,
  forwardToChannel,
  sendResponse
} from './forwarding';
import Config from '../../../assets/config';
import { World } from 'vrchat';
import { emojiMap } from '../../../assets/media';

type WorldMatchSource = 'body' | 'snapshot' | 'attachment';

type WorldMatch = {
  worldId: string;
  sourceContent: string;
  sourceKind: WorldMatchSource;
};

const eachAttachment = (message: Message) =>
  message.attachments?.values() ?? [][Symbol.iterator]();

/**
 * Parse the VRChat world data JSON the API stores on the record.
 * Falls back to a minimal shape when the data is unavailable.
 */
function parseWorldData(vrchatData: string | null): World {
  if (vrchatData) {
    try {
      return JSON.parse(vrchatData) as World;
    } catch {
      logger.warn('Failed to parse vrchatData from API record');
    }
  }
  return {
    id: '',
    name: '',
    authorName: '',
    capacity: 0,
    imageUrl: '',
    unityPackages: []
  } as World;
}

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
export const findAllWorldMatches = async (
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
 * Processes a world ID: posts to the API (which fetches data, extracts tags,
 * and detects duplicates), creates embed, sends the bot reply, then forwards it.
 *
 * When `silent` is true, no embeds/replies/forwards are sent. This is used by
 * crawlHistory to backfill worlds from channel history without spamming chat.
 */
export const processWorldId = async (
  message: Message,
  worldId: string,
  sourceContent: string,
  options?: {
    skipDuplicateCheck?: boolean;
    silent?: boolean;
    internalAddDate?: number;
  }
): Promise<void> => {
  const skipDuplicateCheck = options?.skipDuplicateCheck ?? false;
  const silent = options?.silent ?? false;

  const messageTimestamp =
    typeof message.createdTimestamp === 'number'
      ? Math.floor(message.createdTimestamp / 1000)
      : Math.floor(Date.now() / 1000);

  const response = await api.addWorld({
    worldId,
    guildId: message.guildId ?? '',
    messageId: message.id,
    content: buildTagSource(message, [sourceContent]),
    messageTimestamp: options?.internalAddDate ?? messageTimestamp,
    checkDuplicate: !skipDuplicateCheck && !Config.DEV_MODE
  });

  if (response.duplicate) {
    logger.info(
      `World id ${worldId} has already been shared, retrieving original message id...`
    );

    if (silent) {
      logger.debug(
        `Silent duplicate detection: World ${worldId} is a duplicate of message ${response.existingMessageId}`
      );
      return;
    }

    const originalMessageLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${response.existingMessageId}`;
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
    return;
  }

  const worldData = parseWorldData(response.world.vrchatData);
  const supportedPlatforms = getSupportedPlatforms(
    worldData?.unityPackages ?? []
  );
  logger.info(
    `Saved world ${worldId} with tags: ${response.world.tags.join(', ') || 'none'}`
  );

  if (silent) {
    logger.info(`Silent processing complete for ${worldId}`);
    return;
  }

  const packageSizes = response.world.packageSizes ?? [];
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
