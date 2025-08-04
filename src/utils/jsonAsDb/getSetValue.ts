import { kv } from './index';
import { kvKeys } from './types';

const getListForKey = async (key: kvKeys) => {
  const watchedItems = await kv.get(key);
  return watchedItems || [];
};

const setListForKey = (key: kvKeys, toSave: string[]) => {
  return kv.set(key, toSave);
};

export const addItemToList = async (
  key: kvKeys,
  itemIdToSave: string
): Promise<void> => {
  const currentWatchedItems = (await getListForKey(key)) as string[];
  return setListForKey(key, [...currentWatchedItems, itemIdToSave]);
};

export const removeItemFromList = async (
  key: kvKeys,
  itemIdToRemove: string
): Promise<void> => {
  const currentWatchedItems = (await getListForKey(key)) as string[];
  return setListForKey(
    key,
    currentWatchedItems.filter((itemId) => itemId !== itemIdToRemove)
  );
};

export const isItemInList = async (
  key: kvKeys,
  itemId: string
): Promise<boolean> => {
  const currentWatchedItems = (await getListForKey(key)) as string[];
  return currentWatchedItems.includes(itemId);
};
