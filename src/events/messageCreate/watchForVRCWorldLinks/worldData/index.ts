import { World } from 'vrchat';
import {
  getSupportedPlatforms,
  getFileSizeForPlatform
} from '../../../../utils/helpers';

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
