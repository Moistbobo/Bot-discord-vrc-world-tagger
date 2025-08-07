import { kvKeys } from '../types';
import { get, set, del } from '../index';

/**
 * Get all items from a list
 */
export const getAll = async (key: kvKeys): Promise<string[]> => {
  const result = await get<string[]>(key);
  return result || [];
};

/**
 * Get the first item from a list
 */
export const getFirst = async (key: kvKeys): Promise<string | undefined> => {
  const items = await getAll(key);
  return items[0];
};

/**
 * Check if an item exists in a list
 */
export const has = async (key: kvKeys, itemId: string): Promise<boolean> => {
  const items = await getAll(key);
  return items.includes(itemId);
};

/**
 * Add an item to a list
 */
export const add = async (
  key: kvKeys,
  itemId: string,
  checkDuplicates = false
): Promise<{ success: boolean; error?: string }> => {
  try {
    const items = await getAll(key);

    if (checkDuplicates && items.includes(itemId)) {
      return { success: true }; // Item already exists, consider this a success
    }

    const success = await set(key, [...items, itemId]);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Remove an item from a list
 */
export const remove = async (
  key: kvKeys,
  itemId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const items = await getAll(key);
    const filteredItems = items.filter((item) => item !== itemId);

    const success = await set(key, filteredItems);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Replace entire list with a single item
 */
export const replace = async (
  key: kvKeys,
  itemId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const success = await set(key, [itemId]);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Clear all items from a list
 */
export const clear = async (
  key: kvKeys
): Promise<{ success: boolean; error?: string }> => {
  try {
    const success = await del(key);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
