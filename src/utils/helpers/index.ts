import { UnityPackage } from 'vrchat';

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
