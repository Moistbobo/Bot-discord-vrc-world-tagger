import { kv, kvKeys } from './index';

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
  // @ts-expect-error this is fine
  const currentWatchedChannels: string[] = await getWatchedChannels();

  return setWatchedChannels([...currentWatchedChannels, channelIdToSave]);
};

export const removeChannelFromWatch = async (
  channelIdToRemove: string
): Promise<void> => {
  // @ts-expect-error this is fine
  const currentWatchedChannels: string[] = await getWatchedChannels();

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
