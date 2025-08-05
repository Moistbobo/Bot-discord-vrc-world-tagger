import { FileVersion, UnityPackage, World } from 'vrchat';
import { getFileIdFromAssetUrl } from './regex';
import { vrchat } from './vrchat';

export const getSupportedPlatforms = (
  unityPackages: Array<UnityPackage>
): string[] => {
  const platforms = new Set<string>(
    unityPackages.map((pkg) => pkg.platform || '')
  );

  const support: Record<string, number> = {
    standalonewindows: platforms.has('standalonewindows') ? 1 : 0,
    android: platforms.has('android') ? 1 : 0
  };

  return Object.keys(support).filter((key) => support[key] > 0);
};

export const hasAndroidSupport = (supportedPlatforms: string[]): boolean => {
  return supportedPlatforms.includes('android');
};

export const getWorldNameId = (data: World) => {
  return `${data.name}-${data.id}`;
};

export const buildWorldUrl = (worldId: string) =>
  `https://vrchat.com/home/world/${worldId}`;

export const getMostRecentUnityPackageForPlatform = (
  data: World,
  platform: 'standalonewindows' | 'android'
) => {
  const filteredPackages = data.unityPackages.filter(
    (pkg) => pkg.platform === platform
  );

  if (filteredPackages.length === 0) {
    return null;
  }

  filteredPackages.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return filteredPackages[0];
};

export const getRecentFileVersion = (versions: Array<FileVersion>) => {
  const sortedVersions = versions.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sortedVersions[0];
};

export const bytesToMegabytes = (bytes: number) => {
  return bytes / 1048576; // 1 MB = 1048576 bytes
};

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
