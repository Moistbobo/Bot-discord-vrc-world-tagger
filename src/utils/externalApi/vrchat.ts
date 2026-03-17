import type { CurrentUser, RequiresTwoFactorAuth } from 'vrchat';
import { VRChat } from 'vrchat';
import Config from '../../assets/config';
import KeyvFile from 'keyv-file';
import packageJson from '../../../package.json';

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

/**
 * Type guard: getCurrentUser can return CurrentUser or RequiresTwoFactorAuth (200).
 * RequiresTwoFactorAuth only has `requiresTwoFactorAuth`; CurrentUser has `displayName`.
 */
export function isCurrentUser(
  data: CurrentUser | RequiresTwoFactorAuth
): data is CurrentUser {
  return 'displayName' in data;
}

export const getUserIdByName = async (name: string) => {
  const searchResults = await vrchat.searchUsers({
    client: vrchat.client,
    query: { search: name }
  });

  if (searchResults.data) {
    return searchResults.data[0];
  }
};

export const searchByWorldName = async (worldName: string) => {
  const searchResults = await vrchat.searchWorlds({
    client: vrchat.client,
    query: { search: `"${worldName}"`, fuzzy: true, n: 10, sort: 'relevance' }
  });

  return searchResults.data;
};
