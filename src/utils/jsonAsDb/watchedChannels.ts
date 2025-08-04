import { kv } from './index';
import { kvKeys } from './types';

const getWatchedChannels = async () => {
  const watchedChannels = await kv.get(kvKeys.WATCHED_CHANNELS);
  return watchedChannels || [];
};

const setWatchedChannels = (toSave) => {
  return kv.set(kvKeys.WATCHED_CHANNELS, toSave);
};

export const addNewChannelToWatch = async (
  channelIdToSave: string
): Promise<void> => {
  const currentWatchedChannels = (await getWatchedChannels()) as string[];

  return setWatchedChannels([...currentWatchedChannels, channelIdToSave]);
};

export const removeChannelFromWatch = async (
  channelIdToRemove: string
): Promise<void> => {
  const currentWatchedChannels = (await getWatchedChannels()) as string[];

  return setWatchedChannels(
    currentWatchedChannels.filter(
      (channelId) => channelId !== channelIdToRemove
    )
  );
};

export const isChannelOnWatchList = async (channelId: string) => {
  const currentWatchedChannels = (await getWatchedChannels()) as string[];

  return currentWatchedChannels.includes(channelId);
};
