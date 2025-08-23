import {
  extractAuthorName,
  extractWorldId,
  extractWorldName,
  getLinkFromMessage,
  extractWithCustomMatcher,
  removeLinksFromTweet,
  extractWorldAndAuthor
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
  if (worldName === null || authorName === null) {
    const cleaned = removeLinksFromTweet(tweetContent);
    const combined = extractWorldAndAuthor(cleaned);
    if (combined) {
      worldName = worldName ?? combined.worldName;
      authorName = authorName ?? combined.authorName;
    }
  }
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
        tweetContent: tweetContent?.substring(0, 200) + '...' // Log first 200 chars
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
 * @param data - Array of limited world data to search through
 * @param authorName - The author name to match against
 * @returns The world with the closest matching author name, or undefined if error occurs
 */
export const filterWorldsWithAuthorName = (
  data: LimitedWorld[],
  authorName: string
): LimitedWorld | undefined => {
  try {
    // Input validation
    if (!data || !Array.isArray(data)) {
      logger.warn(
        'filterWorldsWithAuthorName: Invalid data parameter - not an array'
      );
      return undefined;
    }

    if (!authorName || typeof authorName !== 'string') {
      logger.warn(
        'filterWorldsWithAuthorName: Invalid authorName parameter - not a string'
      );
      return undefined;
    }

    if (data.length === 0) {
      logger.info('filterWorldsWithAuthorName: Empty data array provided');
      return undefined;
    }

    // Check if data has the expected structure
    if (
      !data.every(
        (item) => item && typeof item === 'object' && 'authorName' in item
      )
    ) {
      logger.warn(
        'filterWorldsWithAuthorName: Data array contains invalid items - missing authorName property'
      );
      return undefined;
    }

    // Extract author names safely
    const authorNames = data
      .map((x) => {
        if (x && x.authorName && typeof x.authorName === 'string') {
          return x.authorName;
        }
        logger.warn(
          'filterWorldsWithAuthorName: Invalid authorName found in data item:',
          x
        );
        return '';
      })
      .filter((name) => name !== ''); // Remove empty names

    if (authorNames.length === 0) {
      logger.warn(
        'filterWorldsWithAuthorName: No valid author names found in data'
      );
      return undefined;
    }

    // Find closest author name using Levenshtein distance
    let closestName: string;
    try {
      closestName = closest(authorName, authorNames);
    } catch (levenshteinError) {
      logger.error(
        'filterWorldsWithAuthorName: Error in Levenshtein comparison:',
        levenshteinError
      );
      // Fallback: return first item if Levenshtein fails
      return data[0];
    }

    if (!closestName) {
      logger.warn(
        'filterWorldsWithAuthorName: Levenshtein comparison returned no result'
      );
      return data[0]; // Fallback to first item
    }

    // Find the index of the closest name
    const indexOfClosestName = authorNames.indexOf(closestName);

    if (indexOfClosestName === -1) {
      logger.warn(
        'filterWorldsWithAuthorName: Could not find closest name in authorNames array'
      );
      return data[0]; // Fallback to first item
    }

    // Return the world data for the closest matching author
    const result = data[indexOfClosestName];

    if (!result) {
      logger.warn(
        'filterWorldsWithAuthorName: No result found at calculated index'
      );
      return data[0]; // Fallback to first item
    }

    logger.info(
      `filterWorldsWithAuthorName: Successfully matched author "${authorName}" to "${closestName}"`
    );
    return result;
  } catch (error) {
    // Catch any unexpected errors
    logger.error(
      'filterWorldsWithAuthorName: Unexpected error occurred:',
      error
    );

    // Return first item as fallback if available, otherwise undefined
    if (data && Array.isArray(data) && data.length > 0) {
      logger.info(
        'filterWorldsWithAuthorName: Returning first item as fallback due to error'
      );
      return data[0];
    }

    return undefined;
  }
};
