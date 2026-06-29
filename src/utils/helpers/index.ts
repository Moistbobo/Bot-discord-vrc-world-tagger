import { FileVersion, UnityPackage, World } from 'vrchat';
import { getFileIdFromAssetUrl } from '../regex';
import { vrchat } from '../externalApi/vrchat';

export const getSupportedPlatforms = (
  unityPackages: Array<UnityPackage>
): string[] => {
  const platforms = new Set<string>(
    unityPackages.map((pkg) => pkg.platform || '')
  );

  // Adding a platform here will result in additional data being displayed under the
  // Supported platforms and Download sizes sections
  const support: Record<string, number> = {
    standalonewindows: platforms.has('standalonewindows') ? 1 : 0,
    android: platforms.has('android') ? 1 : 0,
    ios: platforms.has('ios') ? 1 : 0
  };

  return Object.keys(support).filter((key) => support[key] > 0);
};

export const hasAndroidSupport = (supportedPlatforms: string[]): boolean => {
  return supportedPlatforms.includes('android');
};

export const buildWorldUrl = (worldId: string) =>
  `https://vrchat.com/home/world/${worldId}`;

export const getMostRecentUnityPackageForPlatform = (
  data: World,
  platform: string
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

const DISCORD_EPOCH_MS = 1420070400000;

/**
 * Derive the Unix timestamp (in seconds) from a Discord message/snowflake ID.
 * This is used to recover the original message timestamp when only the ID
 * is available (e.g., the v1 -> v2 migration data).
 */
export function getDiscordMessageTimestampSeconds(messageId: string): number {
  const snowflake = BigInt(messageId);
  const timestampMs = Number(snowflake >> BigInt(22)) + DISCORD_EPOCH_MS;
  return Math.floor(timestampMs / 1000);
}

export const getFileSizeForPlatform = async (data: World, platform: string) => {
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
