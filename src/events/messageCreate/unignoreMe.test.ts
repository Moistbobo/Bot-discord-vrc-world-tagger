import { unignoreMe } from './unignoreMe';
import type { MockedFunction } from 'vitest';
import { has, remove } from '../../utils/jsonAsDb/handlers/persistentList';

vi.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: vi.fn(),
  remove: vi.fn()
}));

const mockedHas = has as MockedFunction<typeof has>;
const mockedRemove = remove as MockedFunction<typeof remove>;

const makeMessage = (authorId: string) => {
  const send = vi.fn().mockResolvedValue(undefined);
  return {
    author: { id: authorId, bot: false },
    channel: { isSendable: () => true, send }
  } as any;
};

describe('unignoreMe', () => {
  beforeEach(() => {
    mockedHas.mockReset();
    mockedRemove.mockReset();
  });

  it('tells the user when not on the list', async () => {
    mockedHas.mockResolvedValue(false);
    const message = makeMessage('u1');
    await unignoreMe(message);
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      'You are not on the ignore list.'
    );
  });

  it('removes the user and confirms', async () => {
    mockedHas.mockResolvedValue(true);
    mockedRemove.mockResolvedValue({ success: true });
    const message = makeMessage('u2');
    await unignoreMe(message);
    expect(mockedRemove).toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      expect.stringContaining('You have been removed from the ignore list')
    );
  });

  it('reports failure when remove does not succeed', async () => {
    mockedHas.mockResolvedValue(true);
    mockedRemove.mockResolvedValue({ success: false, error: 'disk full' });
    const message = makeMessage('u3');
    await unignoreMe(message);
    expect(message.channel.send).toHaveBeenCalledWith(
      'Could not update the ignore list. Please try again later.'
    );
  });
});
