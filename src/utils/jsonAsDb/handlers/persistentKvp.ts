import { kvKeys } from '../types';
import { get, set } from '../index';

/**
 * Get a value from a key-value pair
 */
export const getValue = async (
  key: kvKeys,
  keyToGet: string
): Promise<string | undefined> => {
  const kvp = await get<Record<string, string>>(key);
  return kvp?.[keyToGet];
};

/**
 * Set a value in a key-value pair
 */
export const setValue = async (
  key: kvKeys,
  keyToSet: string,
  valueToSet: string
): Promise<boolean> => {
  const kvp = (await get<Record<string, string>>(key)) || {};
  const newKvp = { ...kvp, [keyToSet]: valueToSet };
  return await set(key, newKvp);
};

/**
 * Remove a key-value pair
 */
export const removeValue = async (
  key: kvKeys,
  keyToRemove: string
): Promise<boolean> => {
  try {
    const kvp = await get<Record<string, string>>(key);
    if (!kvp || !kvp[keyToRemove]) {
      return false;
    }
    delete kvp[keyToRemove];
    return await set(key, kvp);
  } catch (error) {
    console.error(error);
    return false;
  }
};
