import { World } from 'vrchat';
import { vrchat } from '../../../utils/externalApi/vrchat';
import {
  getSupportedPlatforms,
  getFileSizeForPlatform
} from '../../../utils/helpers';

/**
 * Fetches world data from VRChat API
 */
export const fetchWorldData = async (worldId: string): Promise<World> => {
  const { data } = await vrchat.getWorld({
    client: vrchat.client,
    path: { worldId }
  });

  return data;
};

/**
 * Calculates package sizes for all supported platforms
 */
export const calculatePackageSizes = async (data: World): Promise<number[]> => {
  const supportedPlatforms = getSupportedPlatforms(data.unityPackages);

  const sizePromises = supportedPlatforms.map(async (platform) => {
    return await getFileSizeForPlatform(data, platform);
  });

  return await Promise.all(sizePromises);
};
