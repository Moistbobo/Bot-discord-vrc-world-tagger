import { removeTwitterLink } from '../regex';
import logger from '../logger';

const getWorldLinkFromTwitterLink = async (twitterLink: string) => {
  const BASE_URL = 'https://api.vxtwitter.com';

  const cleanedTwitterLink = removeTwitterLink(twitterLink);

  logger.info('cleaned link', cleanedTwitterLink);

  if (cleanedTwitterLink) {
    try {
      logger.info('parsing vxtwitter', `${BASE_URL}/${cleanedTwitterLink}`);

      const response = await fetch(`${BASE_URL}/${cleanedTwitterLink}`);

      const responseJson = await response.json();

      return responseJson.text;
    } catch (error) {
      logger.error(error);
    }
  }
};

export default getWorldLinkFromTwitterLink;
