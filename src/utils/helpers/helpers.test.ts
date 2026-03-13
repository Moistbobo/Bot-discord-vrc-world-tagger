// Mocks for dependencies used by helpers
jest.mock('../externalApi/vrchat', () => {
  return {
    vrchat: {
      client: {},
      getFile: jest.fn()
    }
  };
});

jest.mock('../regex', () => {
  return {
    getFileIdFromAssetUrl: jest.fn()
  };
});

import {
  getSupportedPlatforms,
  hasAndroidSupport,
  buildWorldUrl,
  getMostRecentUnityPackageForPlatform,
  getRecentFileVersion,
  bytesToMegabytes,
  getFileSizeForPlatform
} from './index';

import { vrchat } from '../externalApi/vrchat';
import { getFileIdFromAssetUrl } from '../regex';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

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

  describe('getMostRecentUnityPackageForPlatform', () => {
    const world = {
      unityPackages: [
        {
          platform: 'android',
          created_at: '2024-01-02T00:00:00Z',
          assetUrl: 'https://cdn/asset_new'
        },
        {
          platform: 'android',
          created_at: '2023-12-31T00:00:00Z',
          assetUrl: 'https://cdn/asset_old'
        },
        {
          platform: 'standalonewindows',
          created_at: '2024-01-01T00:00:00Z',
          assetUrl: 'https://cdn/pc_asset'
        }
      ]
    } as any;

    it('returns most recent package for platform', () => {
      const pkg = getMostRecentUnityPackageForPlatform(world, 'android');
      expect(pkg?.assetUrl).toBe('https://cdn/asset_new');
    });

    it('returns null when no packages for platform', () => {
      const pkg = getMostRecentUnityPackageForPlatform(world, 'ios');
      expect(pkg).toBeNull();
    });
  });

  describe('getRecentFileVersion', () => {
    it('returns the latest version by created_at', () => {
      const versions = [
        { created_at: '2023-01-01T00:00:00Z', file: { sizeInBytes: 1 } },
        { created_at: '2024-01-01T00:00:00Z', file: { sizeInBytes: 2 } }
      ] as any[];

      const recent = getRecentFileVersion(versions);
      expect(recent.file.sizeInBytes).toBe(2);
    });
  });

  describe('bytesToMegabytes', () => {
    it('converts bytes to megabytes', () => {
      expect(bytesToMegabytes(1048576)).toBe(1);
      expect(bytesToMegabytes(2097152)).toBe(2);
      expect(bytesToMegabytes(524288)).toBe(0.5);
    });
  });

  describe('getFileSizeForPlatform', () => {
    it('fetches file info for most recent package and returns size in MB', async () => {
      const world = {
        unityPackages: [
          {
            platform: 'android',
            created_at: '2023-01-01T00:00:00Z',
            assetUrl: 'https://cdn/asset_old'
          },
          {
            platform: 'android',
            created_at: '2024-02-01T00:00:00Z',
            assetUrl: 'https://cdn/asset_new'
          }
        ]
      } as any;

      asMock(getFileIdFromAssetUrl).mockReturnValue('abcd-1234');
      asMock(vrchat.getFile).mockResolvedValue({
        data: {
          versions: [
            {
              created_at: '2023-12-31T00:00:00Z',
              file: { sizeInBytes: 1048576 }
            },
            {
              created_at: '2024-02-15T00:00:00Z',
              file: { sizeInBytes: 10485760 }
            }
          ]
        }
      } as any);

      const sizeMb = await getFileSizeForPlatform(world, 'android');

      expect(getFileIdFromAssetUrl).toHaveBeenCalledWith(
        'https://cdn/asset_new'
      );
      expect(vrchat.getFile).toHaveBeenCalledWith({
        client: vrchat.client,
        path: { fileId: 'file_abcd-1234' }
      });
      expect(sizeMb).toBe(10);
    });
  });
});
