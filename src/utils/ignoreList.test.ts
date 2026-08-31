import { isUserOnIgnoreList } from './ignoreList';
import type { MockedFunction } from 'vitest';
import { has } from './jsonAsDb/handlers/persistentList';
import { kvKeys } from './jsonAsDb/types';

vi.mock('./jsonAsDb/handlers/persistentList', () => ({
  has: vi.fn()
}));

const mockedHas = has as MockedFunction<typeof has>;

describe('isUserOnIgnoreList', () => {
  beforeEach(() => {
    mockedHas.mockReset();
  });

  it('returns true when user id is in IGNORED_USERS', async () => {
    mockedHas.mockResolvedValue(true);
    await expect(isUserOnIgnoreList('user-1')).resolves.toBe(true);
    expect(mockedHas).toHaveBeenCalledWith(kvKeys.IGNORED_USERS, 'user-1');
  });

  it('returns false when user id is not listed', async () => {
    mockedHas.mockResolvedValue(false);
    await expect(isUserOnIgnoreList('user-2')).resolves.toBe(false);
  });
});
