import { kvKeys } from './jsonAsDb/types';
import { getFirst } from './jsonAsDb/handlers/persistentList';
import {
  getValue,
  removeValue,
  setValue
} from './jsonAsDb/handlers/persistentKvp';

export interface HighPriorityForward {
  worldId: string;
  guildId: string;
}

export const isHighPriorityChannel = async (
  channelId: string
): Promise<boolean> => {
  const hpChannel = await getFirst(kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL);
  return hpChannel === channelId;
};

export const recordHighPriorityForward = async (
  messageId: string,
  value: HighPriorityForward
): Promise<boolean> => {
  const hpChannel = await getFirst(kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL);
  if (!hpChannel) return false;
  return setValue(
    kvKeys.HIGH_PRIORITY_FORWARDED_MESSAGES,
    messageId,
    JSON.stringify(value)
  );
};

export const takeHighPriorityForward = async (
  messageId: string
): Promise<HighPriorityForward | null> => {
  const raw = await getValue(
    kvKeys.HIGH_PRIORITY_FORWARDED_MESSAGES,
    messageId
  );
  if (!raw) return null;
  await removeValue(kvKeys.HIGH_PRIORITY_FORWARDED_MESSAGES, messageId);
  try {
    return JSON.parse(raw) as HighPriorityForward;
  } catch {
    return null;
  }
};
