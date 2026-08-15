import clearHighPriorityChannel from './clearHighPriorityChannel';
import { clear } from '../../utils/jsonAsDb/handlers/persistentList';

jest.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  clear: jest.fn()
}));

const mockedClear = clear as jest.MockedFunction<typeof clear>;

const makeMessage = () => {
  const send = jest.fn().mockResolvedValue(undefined);
  return {
    author: { id: 'admin-1', tag: 'admin#1', bot: false },
    channel: { isSendable: () => true, send }
  } as any;
};

describe('clearHighPriorityChannel', () => {
  beforeEach(() => {
    mockedClear.mockReset();
  });

  it('clears the channel and confirms', async () => {
    mockedClear.mockResolvedValue({ success: true });
    const message = makeMessage();
    await clearHighPriorityChannel(message);
    expect(mockedClear).toHaveBeenCalledWith(
      'HIGH_PRIORITY_FORWARDING_CHANNEL'
    );
    expect(message.channel.send).toHaveBeenCalledWith(
      'Cleared the high priority channel configuration.'
    );
  });

  it('reports failure when clearing fails', async () => {
    mockedClear.mockResolvedValue({ success: false });
    const message = makeMessage();
    await clearHighPriorityChannel(message);
    expect(message.channel.send).toHaveBeenCalledWith(
      'Failed to clear the high priority channel.'
    );
  });
});
