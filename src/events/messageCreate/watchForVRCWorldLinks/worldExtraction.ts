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
  const worldName = extractWorldName(tweetContent).trim();
  const authorName = extractAuthorName(tweetContent).trim();

  const limitedWorldData = await searchByWorldAndAuthorName(
    worldName,
    authorName
  );

  const world = filterWorldsWithAuthorName(limitedWorldData, authorName);

  return world.id;
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
