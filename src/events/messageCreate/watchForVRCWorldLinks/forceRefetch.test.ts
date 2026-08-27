import { Attachment, Message } from 'discord.js';
import type { Mock } from 'vitest';

vi.mock('../../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  getValue: vi.fn(),
  setValue: vi.fn()
}));

vi.mock('../../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: vi.fn()
}));

vi.mock('./worldExtraction', () => ({
  extractWorldIdFromMessage: vi.fn()
}));

vi.mock('./embedBuilder', () => ({
  createWorldEmbed: vi.fn(() => ({}))
}));

vi.mock('./forwarding', () => ({
  getForwardingChannels: vi.fn().mockResolvedValue([]),
  forwardToChannel: vi.fn(),
  sendResponse: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../utils/apiClient', () => ({
  api: {
    addWorld: vi.fn()
  }
}));

vi.mock('../../../utils/helpers', () => ({
  getSupportedPlatforms: vi.fn(() => [])
}));

vi.mock('../../../assets/config', () => ({
  __esModule: true,
  default: {
    DEV_MODE: false,
    FORWARD_PLAYER_COUNT_THRESHOLD: 40,
    LOW_CAPACITY_THRESHOLD: 1
  }
}));

vi.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../assets/media', () => ({
  emojiMap: {
    recycle: '♻',
    actually: '<:actually:1>'
  }
}));

import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import { extractWorldIdFromMessage } from './worldExtraction';
import { api } from '../../../utils/apiClient';
import { forceRefetchWorldFromMessage } from './index';

const WRLD = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('forceRefetchWorldFromMessage', () => {
  const makeMessage = (overrides: Partial<Message> = {}) =>
    ({
      id: 'msg-1',
      guildId: 'guild-1',
      channelId: 'chan-1',
      content: 'https://example.com/world',
      messageSnapshots: undefined,
      channel: { isSendable: () => true },
      react: vi.fn(),
      reply: vi.fn(),
      ...overrides
    }) as Message;

  beforeEach(() => {
    vi.clearAllMocks();
    (has as Mock).mockResolvedValue(true);
    (extractWorldIdFromMessage as Mock).mockResolvedValue(WRLD);
    (api.addWorld as Mock).mockResolvedValue({
      duplicate: false,
      world: {
        worldId: WRLD,
        guildId: 'guild-1',
        messageId: 'msg-1',
        name: 'W',
        authorName: 'A',
        imageUrl: 'https://x',
        unityPackages: [],
        capacity: 8,
        platforms: [],
        packageSizes: [],
        tags: [],
        vrchatData: JSON.stringify({
          id: WRLD,
          name: 'W',
          authorName: 'A',
          imageUrl: 'https://x',
          unityPackages: [],
          capacity: 8
        })
      }
    });
  });

  it('refetches and processes world when not yet tracked', async () => {
    const message = makeMessage();
    const result = await forceRefetchWorldFromMessage(message);

    expect(result).toBe(true);
    expect(api.addWorld).toHaveBeenCalledWith(
      expect.objectContaining({ worldId: WRLD, checkDuplicate: false })
    );
  });

  it('refetches even when world is already tracked (force refetch skips duplicate check)', async () => {
    await forceRefetchWorldFromMessage(makeMessage());

    expect(api.addWorld).toHaveBeenCalledWith(
      expect.objectContaining({ worldId: WRLD, checkDuplicate: false })
    );
  });

  it('does not call getValue or setValue (legacy KVP removed)', async () => {
    const { getValue, setValue } =
      await import('../../../utils/jsonAsDb/handlers/persistentKvp');

    await forceRefetchWorldFromMessage(makeMessage());

    expect(getValue).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('returns false when no world id in message', async () => {
    (extractWorldIdFromMessage as Mock).mockResolvedValue(null);

    const result = await forceRefetchWorldFromMessage(makeMessage());

    expect(result).toBe(false);
  });

  it('returns false when channel is not watched (including attachment filenames)', async () => {
    (has as Mock).mockResolvedValue(false);
    (extractWorldIdFromMessage as Mock).mockResolvedValue(null);

    const att = { name: `capture-${WRLD}.png` } as Attachment;
    const message = {
      ...makeMessage(),
      content: '',
      attachments: {
        values: () => [att].values() as IterableIterator<Attachment>
      }
    } as unknown as Message;

    const result = await forceRefetchWorldFromMessage(message);

    expect(result).toBe(false);
  });

  it('refetches world id from attachment filename when message text has none', async () => {
    (extractWorldIdFromMessage as Mock).mockResolvedValue(null);

    const att = { name: `capture-${WRLD}.png` } as Attachment;
    const message = {
      ...makeMessage(),
      content: '',
      attachments: {
        values: () => [att].values() as IterableIterator<Attachment>
      }
    } as unknown as Message;

    const result = await forceRefetchWorldFromMessage(message);

    expect(result).toBe(true);
    expect(api.addWorld).toHaveBeenCalledWith(
      expect.objectContaining({ worldId: WRLD })
    );
  });
});
