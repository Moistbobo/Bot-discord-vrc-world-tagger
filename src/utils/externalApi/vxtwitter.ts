import { removeTwitterLink } from '../regex';
import logger from '../logger';

interface VxTwitterResponse {
  text: string;
  // Add other potential fields if needed
}

const VX_TWITTER_BASE_URL = 'https://api.vxtwitter.com';

/**
 * Fetches the text content from a Twitter/X link using the VxTwitter API
 * @param twitterLink - The Twitter/X link to process
 * @returns The text content from the tweet, or null if processing fails
 */
const getWorldLinkFromTwitterLink = async (
  twitterLink: string
): Promise<string | null> => {
  if (!twitterLink) {
    logger.warn('getWorldLinkFromTwitterLink called with empty twitterLink');
    return null;
  }

  const cleanedTwitterLink = removeTwitterLink(twitterLink);

  if (!cleanedTwitterLink) {
    logger.warn('Failed to extract Twitter link from:', twitterLink);
    return null;
  }

  try {
    const apiUrl = `${VX_TWITTER_BASE_URL}/${cleanedTwitterLink}`;
    logger.info('Fetching from VxTwitter API:', apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      logger.error('VxTwitter API request failed:', {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl
      });
      return null;
    }

    const responseData: VxTwitterResponse = await response.json();

    if (!responseData.text) {
      logger.warn('VxTwitter API response missing text field:', responseData);
      return null;
    }

    logger.info('Fetched from VxTwitter API:', responseData.text);

    return responseData.text;
  } catch (error) {
    logger.error('Error fetching from VxTwitter API:', error);
    return null;
  }
};

export default getWorldLinkFromTwitterLink;
