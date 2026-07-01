import { Attachment, Message } from 'discord.js';

jest.mock('../../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  getValue: jest.fn(),
  setValue: jest.fn()
}));

jest.mock('../../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: jest.fn()
}));

jest.mock('./worldExtraction', () => ({
  extractWorldIdFromMessage: jest.fn()
}));

jest.mock('./worldData', () => ({
  fetchWorldData: jest.fn(),
  calculatePackageSizes: jest.fn()
}));

jest.mock('./embedBuilder', () => ({
  createWorldEmbed: jest.fn(() => ({}))
}));

jest.mock('./forwarding', () => ({
  getForwardingChannels: jest.fn().mockResolvedValue([]),
  forwardToChannel: jest.fn(),
  sendResponse: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('./duplicateHandler', () => ({
  checkAndHandleDuplicate: jest.fn()
}));

jest.mock('../../../utils/helpers', () => ({
  getSupportedPlatforms: jest.fn(() => [])
}));

jest.mock('../../../assets/config', () => ({
  __esModule: true,
  default: {
    DEV_MODE: false,
    FORWARD_PLAYER_COUNT_THRESHOLD: 40,
    LOW_CAPACITY_THRESHOLD: 1
  }
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../utils/database/worldRepository', () => ({
  getWorldRepository: jest.fn(() => ({
    upsert: jest.fn()
  }))
}));

jest.mock('../../../utils/tagExtractor', () => ({
  extractTags: jest.fn(() => [])
}));

import { has } from '../../../utils/jsonAsDb/handlers/persistentList';
import { extractWorldIdFromMessage } from './worldExtraction';
import { fetchWorldData, calculatePackageSizes } from './worldData';
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
      ...overrides
    }) as Message;

  beforeEach(() => {
    jest.clearAllMocks();
    (has as jest.Mock).mockResolvedValue(true);
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(WRLD);
    (fetchWorldData as jest.Mock).mockResolvedValue({
      id: WRLD,
      name: 'W',
      authorName: 'A',
      imageUrl: 'https://x',
      unityPackages: [],
      capacity: 8
    });
    (calculatePackageSizes as jest.Mock).mockResolvedValue([]);
  });

  it('refetches and processes world when not yet tracked', async () => {
    const message = makeMessage();
    const result = await forceRefetchWorldFromMessage(message);

    expect(result).toBe(true);
    expect(fetchWorldData).toHaveBeenCalledWith(WRLD);
  });

  it('refetches even when world is already tracked (force refetch skips duplicate check)', async () => {
    await forceRefetchWorldFromMessage(makeMessage());

    expect(fetchWorldData).toHaveBeenCalled();
  });

  it('does not call getValue or setValue (legacy KVP removed)', async () => {
    const { getValue, setValue } =
      await import('../../../utils/jsonAsDb/handlers/persistentKvp');

    await forceRefetchWorldFromMessage(makeMessage());

    expect(getValue).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('returns false when no world id in message', async () => {
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(null);

    const result = await forceRefetchWorldFromMessage(makeMessage());

    expect(result).toBe(false);
  });

  it('returns false when channel is not watched (including attachment filenames)', async () => {
    (has as jest.Mock).mockResolvedValue(false);
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(null);

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
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(null);

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
    expect(fetchWorldData).toHaveBeenCalledWith(WRLD);
  });
});
