import { onMessageDelete } from './onMessageDelete';
import type { Mock } from 'vitest';

import * as highPriorityChannel from '../../utils/highPriorityChannel';
import * as apiClient from '../../utils/apiClient';

vi.mock('../../utils/highPriorityChannel', () => ({
  isHighPriorityChannel: vi.fn(),
  takeHighPriorityForward: vi.fn()
}));

vi.mock('../../utils/apiClient', () => ({
  api: {
    removeHighPriority: vi.fn()
  },
  isApiError: vi.fn()
}));

const { isHighPriorityChannel, takeHighPriorityForward } =
  highPriorityChannel as unknown as {
    isHighPriorityChannel: Mock;
    takeHighPriorityForward: Mock;
  };
const { api } = apiClient as unknown as {
  api: { removeHighPriority: Mock };
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
