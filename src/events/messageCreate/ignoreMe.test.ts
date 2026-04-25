import { ignoreMe } from './ignoreMe';
import { add, has } from '../../utils/jsonAsDb/handlers/persistentList';

jest.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  add: jest.fn(),
  has: jest.fn()
}));

const mockedHas = has as jest.MockedFunction<typeof has>;
const mockedAdd = add as jest.MockedFunction<typeof add>;

const makeMessage = (authorId: string) => {
  const send = jest.fn().mockResolvedValue(undefined);
  return {
    author: { id: authorId, bot: false },
    channel: { isSendable: () => true, send }
  } as any;
};

describe('ignoreMe', () => {
  beforeEach(() => {
    mockedHas.mockReset();
    mockedAdd.mockReset();
  });

  it('tells the user when already ignored', async () => {
    mockedHas.mockResolvedValue(true);
    const message = makeMessage('u1');
    await ignoreMe(message);
    expect(mockedAdd).not.toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      'You are already on the ignore list.'
    );
  });

  it('adds the user and confirms', async () => {
    mockedHas.mockResolvedValue(false);
    mockedAdd.mockResolvedValue({ success: true });
    const message = makeMessage('u2');
    await ignoreMe(message);
    expect(mockedAdd).toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      expect.stringContaining('You are now on the ignore list')
    );
  });

  it('reports failure when add does not succeed', async () => {
    mockedHas.mockResolvedValue(false);
    mockedAdd.mockResolvedValue({ success: false, error: 'disk full' });
    const message = makeMessage('u3');
    await ignoreMe(message);
    expect(message.channel.send).toHaveBeenCalledWith(
      'Could not update the ignore list. Please try again later.'
    );
  });
});
