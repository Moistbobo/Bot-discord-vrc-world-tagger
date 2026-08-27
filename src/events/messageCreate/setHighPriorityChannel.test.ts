import setHighPriorityChannel from './setHighPriorityChannel';
import type { MockedFunction } from 'vitest';
import { add, clear, has } from '../../utils/jsonAsDb/handlers/persistentList';

vi.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  add: vi.fn(),
  clear: vi.fn(),
  has: vi.fn()
}));

const mockedHas = has as MockedFunction<typeof has>;
const mockedClear = clear as MockedFunction<typeof clear>;
const mockedAdd = add as MockedFunction<typeof add>;

const makeMessage = (overrides: Partial<any> = {}) => {
  const send = vi.fn().mockResolvedValue(undefined);
  return {
    author: { id: 'admin-1', tag: 'admin#1', bot: false },
    mentions: {
      channels: { first: vi.fn().mockReturnValue({ id: 'chan1' }) }
    },
    channel: { isSendable: () => true, send },
    ...overrides
  } as any;
};

describe('setHighPriorityChannel', () => {
  beforeEach(() => {
    mockedHas.mockReset();
    mockedClear.mockReset();
    mockedAdd.mockReset();
    mockedClear.mockResolvedValue({ success: true });
    mockedAdd.mockResolvedValue({ success: true });
  });

  it('asks for a channel mention when none given', async () => {
    const message = makeMessage({
      mentions: { channels: { first: vi.fn().mockReturnValue(null) } }
    });
    await setHighPriorityChannel(message);
    expect(mockedAdd).not.toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      'Please mention a channel. Usage: `.setHighPriorityChannel #channel`'
    );
  });

  it('tells the user when the channel is already the high priority channel', async () => {
    mockedHas.mockResolvedValue(true);
    const message = makeMessage();
    await setHighPriorityChannel(message);
    expect(mockedClear).not.toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith(
      '<#chan1> is already the high priority channel.'
    );
  });

  it('sets the channel and explains the high priority behavior', async () => {
    mockedHas.mockResolvedValue(false);
    const message = makeMessage();
    await setHighPriorityChannel(message);
    expect(mockedClear).toHaveBeenCalledWith(
      'HIGH_PRIORITY_FORWARDING_CHANNEL'
    );
    expect(mockedAdd).toHaveBeenCalledWith(
      'HIGH_PRIORITY_FORWARDING_CHANNEL',
      'chan1',
      true
    );
    expect(message.channel.send).toHaveBeenCalledWith(
      expect.stringContaining('Set <#chan1> as the high priority channel')
    );
    expect(message.channel.send).toHaveBeenCalledWith(
      expect.stringContaining('mark it as high priority')
    );
    expect(message.channel.send).toHaveBeenCalledWith(
      expect.stringContaining('React-to-delete')
    );
  });

  it('reports failure when persisting fails', async () => {
    mockedHas.mockResolvedValue(false);
    mockedAdd.mockResolvedValue({ success: false, error: 'disk full' });
    const message = makeMessage();
    await setHighPriorityChannel(message);
    expect(message.channel.send).toHaveBeenCalledWith(
      'Failed to set the high priority channel. Please try again.'
    );
  });
});
