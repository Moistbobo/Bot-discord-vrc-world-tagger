import {
  getSupportedPlatforms,
  hasAndroidSupport,
  buildWorldUrl,
  getDiscordMessageTimestampSeconds
} from './index';

describe('utils/helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedPlatforms', () => {
    it('returns only supported platforms in fixed order', () => {
      const unityPackages = [
        { platform: 'android' },
        { platform: 'standalonewindows' },
        { platform: 'unknown' },
        { platform: '' }
      ] as any[];

      expect(getSupportedPlatforms(unityPackages)).toEqual([
        'standalonewindows',
        'android'
      ]);
    });

    it('returns empty array when none supported', () => {
      const unityPackages = [{ platform: 'quest2' }, { platform: '' }] as any[];
      expect(getSupportedPlatforms(unityPackages)).toEqual([]);
    });
  });

  describe('hasAndroidSupport', () => {
    it('detects android support', () => {
      expect(hasAndroidSupport(['standalonewindows', 'android'])).toBe(true);
      expect(hasAndroidSupport(['standalonewindows'])).toBe(false);
    });
  });

  describe('buildWorldUrl', () => {
    it('builds correct VRChat world URL', () => {
      expect(buildWorldUrl('wrld_abcd')).toBe(
        'https://vrchat.com/home/world/wrld_abcd'
      );
    });
  });

  describe('getDiscordMessageTimestampSeconds', () => {
    it('derives a Unix timestamp from a Discord snowflake', () => {
      const timestamp = getDiscordMessageTimestampSeconds(
        '1234567890123456789'
      );
      expect(timestamp).toBeGreaterThan(1_600_000_000);
      expect(Number.isFinite(timestamp)).toBe(true);
    });

    it('throws on invalid snowflakes', () => {
      expect(() =>
        getDiscordMessageTimestampSeconds('not-a-snowflake')
      ).toThrow();
    });
  });
});
