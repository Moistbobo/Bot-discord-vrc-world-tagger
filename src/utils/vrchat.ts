import { VRChat } from 'vrchat';
import Config from '../assets/config';
import KeyvFile from 'keyv-file';
import packageJson from '../../package.json';

export const vrchat = new VRChat({
  application: {
    name: 'VrcWorldTagger',
    version: packageJson.version,
    contact: 'vrcworldtagger@gmail.com'
  },
  authentication: {
    credentials: {
      username: Config.VRC_USERNAME,
      password: Config.VRC_PASSWORD,
      totpSecret: Config.VRC_TOTP_KEY
    }
  },
  keyv: new KeyvFile({ filename: './data.json' })
});

export const getUserIdByName = async (name: string) => {
  const searchResults = await vrchat.searchUsers({
    client: vrchat.client,
    query: { search: name }
  });

  if (searchResults.data) {
    return searchResults.data[0];
  }
};

export const searchByWorldAndAuthorName = async (
  worldName: string,
  authorName: string
) => {
  const vrcUser = await getUserIdByName(authorName);

  const searchResults = await vrchat.searchWorlds({
    client: vrchat.client,
    query: vrcUser
      ? {
          search: `"${worldName}"`,
          userId: vrcUser.id,
          fuzzy: false,
          n: 10,
          sort: 'relevance'
        }
      : { search: `"${worldName}"`, fuzzy: false, n: 10, sort: 'relevance' }
  });

  return searchResults.data;
};
