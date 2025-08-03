import { UnityPackage } from 'vrchat';

export enum Platforms {
  PC = 'PC',
  PC_ANDROID = 'PC_ANDROID',
  UNKNOWN = 'UNKNOWN'
}

export const getSupportedPlatforms = (
  unityPackages: Array<UnityPackage>
): string[] => {
  const platforms = new Set<string>(
    unityPackages.map((pkg) => pkg.platform || '')
  );

  const support: Record<string, number> = {
    android: platforms.has('android') ? 1 : 0,
    pc: platforms.has('standalonewindows') ? 1 : 0
  };

  return Object.keys(support).filter((key) => support[key] > 0);
};

export const hasAndroidSupport = (supportedPlatforms: string[]): boolean => {
  return supportedPlatforms.includes('android');
};
