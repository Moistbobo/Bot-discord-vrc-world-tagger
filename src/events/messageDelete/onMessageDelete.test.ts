import { onMessageDelete } from './onMessageDelete';

jest.mock('../../utils/highPriorityChannel', () => ({
  isHighPriorityChannel: jest.fn(),
  takeHighPriorityForward: jest.fn()
}));

jest.mock('../../utils/apiClient', () => ({
  api: {
    removeHighPriority: jest.fn()
  },
  isApiError: jest.fn()
}));

const { isHighPriorityChannel, takeHighPriorityForward } = jest.requireMock(
  '../../utils/highPriorityChannel'
) as {
  isHighPriorityChannel: jest.Mock;
  takeHighPriorityForward: jest.Mock;
};
const { api } = jest.requireMock('../../utils/apiClient') as {
  api: { removeHighPriority: jest.Mock };
};

const WORLD_ID = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const HP_CHANNEL = 'hp-chan';

const makeMessage = (overrides: Partial<any> = {}) =>
  ({
    id: 'deleted-msg-1',
    channelId: HP_CHANNEL,
    ...overrides
  }) as any;

describe('onMessageDelete', () => {
  beforeEach(() => {
    isHighPriorityChannel.mockReset();
    takeHighPriorityForward.mockReset();
    api.removeHighPriority.mockReset();
    isHighPriorityChannel.mockResolvedValue(true);
  });

  it('removes high priority when a record exists for the deleted message', async () => {
    takeHighPriorityForward.mockResolvedValue({
      worldId: WORLD_ID,
      guildId: 'guild1'
    });
    await onMessageDelete(makeMessage());

    expect(takeHighPriorityForward).toHaveBeenCalledWith('deleted-msg-1');
    expect(api.removeHighPriority).toHaveBeenCalledWith(WORLD_ID, 'guild1');
  });

  it('does nothing when no record exists for the deleted message', async () => {
    takeHighPriorityForward.mockResolvedValue(null);
    await onMessageDelete(makeMessage());

    expect(takeHighPriorityForward).toHaveBeenCalledWith('deleted-msg-1');
    expect(api.removeHighPriority).not.toHaveBeenCalled();
  });

  it('does nothing in a non-high-priority channel', async () => {
    isHighPriorityChannel.mockResolvedValue(false);
    await onMessageDelete(makeMessage());

    expect(takeHighPriorityForward).not.toHaveBeenCalled();
    expect(api.removeHighPriority).not.toHaveBeenCalled();
  });
});
