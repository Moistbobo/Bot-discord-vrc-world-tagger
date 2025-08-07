import {
  extractAuthorName,
  extractWorldId,
  extractWorldName,
  getLinkFromMessage
} from '../../../utils/regex';
import { searchByWorldAndAuthorName } from '../../../utils/externalApi/vrchat';
import getTweetContent from '../../../utils/externalApi/vxtwitter';
import { LimitedWorld } from 'vrchat';
import { closest } from 'fastest-levenshtein';
import logger from '../../../utils/logger';

/**
 * Extracts world ID from message content or Twitter links
 */
export const extractWorldIdFromMessage = async (
  content: string
): Promise<string | null> => {
  const directWorldId = extractWorldId(content);
  if (directWorldId) {
    return directWorldId;
  }

  const twitterLink = getLinkFromMessage(content);
  if (twitterLink) {
    const tweetContent = await getTweetContent(twitterLink);
    const worldIdFromTwitterLink = extractWorldId(tweetContent);

    if (worldIdFromTwitterLink) return worldIdFromTwitterLink;

    // Try to parse the world data from the tweet content
    return parseWorldInfoFromPlainText(tweetContent);
  }
  return null;
};

export const parseWorldInfoFromPlainText = async (tweetContent: string) => {
  logger.info('Attempting to extract World and Author Name');

  const worldName = extractWorldName(tweetContent);
  const authorName = extractAuthorName(tweetContent);

  // Check if both world name and author name were found
  if (!worldName || !authorName) {
    logger.warn(
      'Could not extract world name or author name from tweet content:',
      {
        worldName: worldName || 'null',
        authorName: authorName || 'null',
        tweetContent: tweetContent.substring(0, 200) + '...' // Log first 200 chars
      }
    );
    return null;
  }

  logger.info(`Extracted - World: "${worldName}", Author: "${authorName}"`);

  const limitedWorldData = await searchByWorldAndAuthorName(
    worldName.trim(),
    authorName.trim()
  );

  const world = filterWorldsWithAuthorName(limitedWorldData, authorName.trim());

  return world?.id;
};

/**
 * Retrieve a world from an array by comparing the author names
 * @param data
 * @param authorName
 */
export const filterWorldsWithAuthorName = (
  data: LimitedWorld[],
  authorName: string
) => {
  // levenshtein compare author names of search result
  const authorNames = data.map((x) => x.authorName);
  const closestName = closest(authorName, authorNames);
  const indexOfClosestName = authorNames.indexOf(closestName);

  return data[indexOfClosestName];
};
