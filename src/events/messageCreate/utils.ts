import { World } from 'vrchat';
import {
  bytesToMegabytes,
  getMostRecentUnityPackageForPlatform,
  getRecentFileVersion
} from '../../utils/helpers';
import { getFileIdFromAssetUrl } from '../../utils/regex';
import { vrchat } from '../../utils/vrchat';

export const getFileSizeForPlatform = async (
  data: World,
  platform: 'standalonewindows' | 'android'
) => {
  const recentPackageForPlatform = getMostRecentUnityPackageForPlatform(
    data,
    platform
  );

  const fileId = getFileIdFromAssetUrl(recentPackageForPlatform.assetUrl);

  const file = await vrchat.getFile({
    client: vrchat.client,
    path: { fileId: `file_${fileId}` }
  });

  const mostRecentVersion = getRecentFileVersion(file.data.versions);

  return bytesToMegabytes(mostRecentVersion.file.sizeInBytes);
};
