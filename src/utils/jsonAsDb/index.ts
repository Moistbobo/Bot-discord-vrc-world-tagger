import KeyvFile from 'keyv-file';
import path from 'path';
import { kvKeys, DbOperationResult } from './types';
import logger from '../logger';

interface KvConfig {
  filename?: string;
}

class Kv extends KeyvFile {
  constructor(config: KvConfig = {}) {
    const defaultFilename = path.join(process.cwd(), 'db.json');
    super({
      filename: config.filename || defaultFilename
    });
  }

  /**
   * Safely get a value with error handling
   */
  async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.get(key);
      return result as T;
    } catch (error) {
      console.error(`Error getting key "${key}":`, error);
      return undefined;
    }
  }

  /**
   * Safely set a value with error handling
   */
  async safeSet<T>(key: string, value: T): Promise<boolean> {
    try {
      await this.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Safely delete a value with error handling
   */
  async safeDelete(key: string): Promise<boolean> {
    try {
      return await this.delete(key);
    } catch (error) {
      console.error(`Error deleting key "${key}":`, error);
      return false;
    }
  }
}

const kv = new Kv();

/**
 * Helper function to get a list from the database
 * @param key - The database key to retrieve
 * @returns Promise resolving to the list or empty array if not found
 */
const getListForKey = async (key: kvKeys): Promise<string[]> => {
  const result = await kv.safeGet<string[]>(key);
  return result || [];
};

/**
 * Helper function to set a list in the database
 * @param key - The database key to set
 * @param toSave - The list to save
 * @returns Promise resolving to operation success
 */
const setListForKey = async (
  key: kvKeys,
  toSave: string[]
): Promise<boolean> => {
  return await kv.safeSet(key, toSave);
};

/**
 * Replaces the entire list for a key with a single item
 * @param key - The database key
 * @param itemIdToSave - The item to save as the only item in the list
 * @returns Promise resolving to operation result
 */
export const replaceListWithItem = async (
  key: kvKeys,
  itemIdToSave: string
): Promise<DbOperationResult> => {
  try {
    const success = await setListForKey(key, [itemIdToSave]);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Adds an item to a list, optionally checking for duplicates
 * @param key - The database key
 * @param itemIdToSave - The item to add
 * @param checkDuplicates - Whether to check for duplicates before adding
 * @returns Promise resolving to operation result
 */
export const addItemToList = async (
  key: kvKeys,
  itemIdToSave: string,
  checkDuplicates = false
): Promise<DbOperationResult> => {
  try {
    const currentItems = await getListForKey(key);

    if (checkDuplicates && currentItems.includes(itemIdToSave)) {
      return { success: true }; // Item already exists, consider this a success
    }

    const success = await setListForKey(key, [...currentItems, itemIdToSave]);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Removes an item from a list
 * @param key - The database key
 * @param itemIdToRemove - The item to remove
 * @returns Promise resolving to operation result
 */
export const removeItemFromList = async (
  key: kvKeys,
  itemIdToRemove: string
): Promise<DbOperationResult> => {
  try {
    const currentItems = await getListForKey(key);
    const filteredItems = currentItems.filter(
      (itemId) => itemId !== itemIdToRemove
    );

    const success = await setListForKey(key, filteredItems);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Checks if an item exists in a list
 * @param key - The database key
 * @param itemId - The item to check for
 * @returns Promise resolving to whether the item exists
 */
export const isItemInList = async (
  key: kvKeys,
  itemId: string
): Promise<boolean> => {
  try {
    const currentItems = await getListForKey(key);
    return currentItems.includes(itemId);
  } catch (error) {
    console.error(
      `Error checking if item "${itemId}" exists in key "${key}":`,
      error
    );
    return false;
  }
};

/**
 * Gets the first item from a list
 * @param key - The database key
 * @returns Promise resolving to the first item or undefined if list is empty
 */
export const getFirstItemInList = async (
  key: kvKeys
): Promise<string | undefined> => {
  try {
    const items = await getListForKey(key);
    return items[0];
  } catch (error) {
    console.error(`Error getting first item from key "${key}":`, error);
    return undefined;
  }
};

/**
 * Completely removes all data for a key
 * @param key - The database key to wipe
 * @returns Promise resolving to operation result
 */
export const wipeValuesForKey = async (
  key: kvKeys
): Promise<DbOperationResult> => {
  try {
    const success = await kv.safeDelete(key);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Gets all items from a list
 * @param key - The database key
 * @returns Promise resolving to the list of items
 */
export const getAllItemsFromList = async (key: kvKeys): Promise<string[]> => {
  try {
    return await getListForKey(key);
  } catch (error) {
    console.error(`Error getting all items from key "${key}":`, error);
    return [];
  }
};

const getKvpForKey = async (
  key: kvKeys
): Promise<Record<string, string> | undefined> => {
  return await kv.safeGet<Record<string, string>>(key);
};

const saveKvpForKey = async (
  key: kvKeys,
  kvp: Record<string, string>
): Promise<boolean> => {
  return await kv.safeSet(key, kvp);
};

export const getKvp = async (
  key: kvKeys,
  keyToGet: string
): Promise<string | undefined> => {
  const kvp = await getKvpForKey(key);
  return kvp?.[keyToGet];
};

export const saveKvp = async (
  key: kvKeys,
  keyToSave: string,
  valueToSave: string
): Promise<boolean> => {
  const kvp = await getKvpForKey(key);
  const newKvp = { ...kvp, [keyToSave]: valueToSave };
  return await saveKvpForKey(key, newKvp);
};

export const removeItemFromKvp = async (
  key: kvKeys,
  keyToRemove: string
): Promise<boolean> => {
  try {
    const kvp = await getKvpForKey(key);
    if (!kvp[keyToRemove]) {
      return false;
    }
    delete kvp[keyToRemove];
    await saveKvpForKey(key, kvp);
    return true;
  } catch (err) {
    logger.error(err);
    return false;
  }
};
