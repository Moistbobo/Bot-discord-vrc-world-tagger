import { isUserOnIgnoreList } from './ignoreList';
import { has } from './jsonAsDb/handlers/persistentList';
import { kvKeys } from './jsonAsDb/types';

jest.mock('./jsonAsDb/handlers/persistentList', () => ({
  has: jest.fn()
}));

const mockedHas = has as jest.MockedFunction<typeof has>;

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
