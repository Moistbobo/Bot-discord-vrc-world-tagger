import { onReactionForward } from './onReactionForward';
import type { Mock } from 'vitest';

import * as jsonAsDb from '../../utils/jsonAsDb';
import * as persistentList from '../../utils/jsonAsDb/handlers/persistentList';
import * as apiClient from '../../utils/apiClient';
import * as highPriorityChannel from '../../utils/highPriorityChannel';

vi.mock('../../utils/jsonAsDb', () => ({
  get: vi.fn()
}));

vi.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: vi.fn(),
  add: vi.fn(),
  getFirst: vi.fn()
}));

vi.mock('../../utils/apiClient', () => ({
  api: {
    setQuality: vi.fn(),
    setHighPriority: vi.fn(),
    removeHighPriority: vi.fn()
  }
}));

vi.mock('../../utils/highPriorityChannel', () => ({
  isHighPriorityChannel: vi.fn(),
  recordHighPriorityForward: vi.fn(),
  takeHighPriorityForward: vi.fn()
}));

const { get } = jsonAsDb as unknown as {
  get: Mock;
};
const { has, add, getFirst } = persistentList as unknown as {
  has: Mock;
  add: Mock;
  getFirst: Mock;
};
const { api } = apiClient as unknown as {
  api: {
    setQuality: Mock;
    setHighPriority: Mock;
    removeHighPriority: Mock;
  };
};
const {
  isHighPriorityChannel,
  recordHighPriorityForward,
  takeHighPriorityForward
} = highPriorityChannel as unknown as {
  isHighPriorityChannel: Mock;
  recordHighPriorityForward: Mock;
  takeHighPriorityForward: Mock;
};

const BOT_ID = 'bot-user-1';
const WORLD_ID = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WORLD_URL = `https://vrchat.com/home/world/${WORLD_ID}`;
const HP_CHANNEL = 'hp-chan';
const QUALITY_CHANNEL = 'quality-good-chan';
const OTHER_CHANNEL = 'other-chan';

const makeReaction = (overrides: Partial<any> = {}) => {
  const { message: messageOverride, ...rest } = overrides;
  return {
    emoji: { name: '📩', id: null, identifier: undefined },
    message: {
      id: 'msg123',
      partial: false,
      fetch: vi.fn(),
      channelId: 'source-chan',
      guildId: 'guild1',
      embeds: [{ url: WORLD_URL }],
      content: '',
      forward: vi.fn().mockResolvedValue({ id: 'forwarded-msg-1' }),
      guild: {
        channels: {
          cache: {
            get: vi.fn().mockReturnValue({
              isSendable: () => true,
              send: vi.fn().mockResolvedValue({ id: 'fallback-msg-9' })
            })
          }
        }
      },
      ...messageOverride
    },
    client: { user: { id: BOT_ID } },
    ...rest
  } as any;
};

describe('onReactionForward', () => {
  beforeEach(() => {
    get.mockReset();
    has.mockReset();
    add.mockReset();
    getFirst.mockReset();
    api.setQuality.mockReset();
    api.setHighPriority.mockReset();
    api.removeHighPriority.mockReset();
    isHighPriorityChannel.mockReset();
    recordHighPriorityForward.mockReset();
    takeHighPriorityForward.mockReset();

    get.mockResolvedValue({ '📩': OTHER_CHANNEL });
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_REACTION_CHANNELS')
    );
    add.mockResolvedValue({ success: true });
    getFirst.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'QUALITY_GOOD_FORWARDING_CHANNEL' ? QUALITY_CHANNEL : undefined
      )
    );
    isHighPriorityChannel.mockResolvedValue(false);
  });

  it('marks the world high priority and records the map entry when forwarding into the high-priority channel', async () => {
    isHighPriorityChannel.mockImplementation((channelId: string) =>
      Promise.resolve(channelId === HP_CHANNEL)
    );
    get.mockResolvedValue({ '📩': HP_CHANNEL });
    const reaction = makeReaction();
    await onReactionForward(reaction, { bot: false } as any);

    expect(api.setHighPriority).toHaveBeenCalledWith(WORLD_ID, 'guild1');
    expect(recordHighPriorityForward).toHaveBeenCalledWith('forwarded-msg-1', {
      worldId: WORLD_ID,
      guildId: 'guild1'
    });
    expect(api.removeHighPriority).not.toHaveBeenCalled();
    expect(takeHighPriorityForward).not.toHaveBeenCalled();
  });

  it('removes high priority and cleans the map when forwarding out of the high-priority channel', async () => {
    isHighPriorityChannel.mockImplementation((channelId: string) =>
      Promise.resolve(channelId === HP_CHANNEL)
    );
    get.mockResolvedValue({ '📩': OTHER_CHANNEL });
    const reaction = makeReaction({
      message: { channelId: HP_CHANNEL }
    });
    await onReactionForward(reaction, { bot: false } as any);

    expect(api.removeHighPriority).toHaveBeenCalledWith(WORLD_ID, 'guild1');
    expect(takeHighPriorityForward).toHaveBeenCalledWith('msg123');
    expect(api.setHighPriority).not.toHaveBeenCalled();
    expect(recordHighPriorityForward).not.toHaveBeenCalled();
  });

  it('keeps the quality side effect and does no high-priority work when neither channel is high priority', async () => {
    get.mockResolvedValue({ '📩': QUALITY_CHANNEL });
    const reaction = makeReaction();
    await onReactionForward(reaction, { bot: false } as any);

    expect(api.setQuality).toHaveBeenCalledWith(WORLD_ID, 'guild1', 'good');
    expect(api.setHighPriority).not.toHaveBeenCalled();
    expect(api.removeHighPriority).not.toHaveBeenCalled();
    expect(recordHighPriorityForward).not.toHaveBeenCalled();
    expect(takeHighPriorityForward).not.toHaveBeenCalled();
  });

  it('records the fallback message id when the forward hits the upload limit', async () => {
    isHighPriorityChannel.mockImplementation((channelId: string) =>
      Promise.resolve(channelId === HP_CHANNEL)
    );
    get.mockResolvedValue({ '📩': HP_CHANNEL });
    const reaction = makeReaction({
      message: {
        forward: vi.fn().mockRejectedValue({ code: 40005 })
      }
    });
    await onReactionForward(reaction, { bot: false } as any);

    expect(api.setHighPriority).toHaveBeenCalledWith(WORLD_ID, 'guild1');
    expect(recordHighPriorityForward).toHaveBeenCalledWith('fallback-msg-9', {
      worldId: WORLD_ID,
      guildId: 'guild1'
    });
  });

  it('does no high-priority work when no world id can be extracted', async () => {
    isHighPriorityChannel.mockImplementation((channelId: string) =>
      Promise.resolve(channelId === HP_CHANNEL)
    );
    get.mockResolvedValue({ '📩': HP_CHANNEL });
    const reaction = makeReaction({
      message: { embeds: [], content: 'no world here' }
    });
    await onReactionForward(reaction, { bot: false } as any);

    expect(api.setHighPriority).not.toHaveBeenCalled();
    expect(recordHighPriorityForward).not.toHaveBeenCalled();
    expect(api.removeHighPriority).not.toHaveBeenCalled();
  });
});
