import {
  extractAuthorName,
  extractWorldId,
  extractWorldName,
  getLinkFromMessage,
  extractWithCustomMatcher,
  removeLinksFromTweet
} from '../../../../utils/regex';
import { searchByWorldAndAuthorName } from '../../../../utils/externalApi/vrchat';
import getTweetContent from '../../../../utils/externalApi/vxtwitter';
import { LimitedWorld } from 'vrchat';
import { closest } from 'fastest-levenshtein';
import logger from '../../../../utils/logger';

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
    return parseWorldInfoFromPlainText(twitterLink, tweetContent);
  }
  return null;
};

export const parseWorldInfoFromPlainText = async (
  twitterLink: string,
  tweetContent: string
) => {
  logger.info('Attempting to extract World and Author Name');

  // Try custom matcher first
  const customMatch = extractWithCustomMatcher(twitterLink, tweetContent);

  let worldName = null;
  let authorName = null;

  if (customMatch) {
    worldName = customMatch.worldName;
    authorName = customMatch.authorName;
  }

  // Fall back to regex extraction if custom matcher didn't work
  if (worldName === null) {
    worldName = extractWorldName(removeLinksFromTweet(tweetContent));
  }
  if (authorName === null) {
    authorName = extractAuthorName(removeLinksFromTweet(tweetContent));
  }

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
