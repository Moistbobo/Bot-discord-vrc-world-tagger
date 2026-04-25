import { has } from './jsonAsDb/handlers/persistentList';
import { kvKeys } from './jsonAsDb/types';

export async function isUserOnIgnoreList(userId: string): Promise<boolean> {
  return has(kvKeys.IGNORED_USERS, userId);
}
