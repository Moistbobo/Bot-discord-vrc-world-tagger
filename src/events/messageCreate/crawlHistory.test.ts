import { Message } from 'discord.js';

jest.mock('./watchForVRCWorldLinks/worldExtraction', () => ({
  extractWorldIdFromMessage: jest.fn(),
  extractAllWorldIdsFromMessage: jest.fn()
}));

jest.mock('./watchForVRCWorldLinks', () => ({
  buildTagSource: jest.fn(() => ''),
  findAllWorldMatches: jest.fn(() => Promise.resolve([])),
  processWorldId: jest.fn()
}));

jest.mock('../../utils/regex', () => ({
  extractWorldId: jest.fn(),
  extractAllWorldIds: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/index', () => ({
  set: jest.fn(),
  get: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  getAll: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  getValue: jest.fn()
}));

jest.mock('../../utils/database/worldRepository', () => ({
  getWorldRepository: jest.fn(() => ({
    updateQuality: jest.fn(),
    backfillInternalAddDate: jest.fn(),
    updateTags: jest.fn(),
    getAllWorldGuildPairs: jest.fn(() => new Set()),
    getByWorldAndGuild: jest.fn(),
    upsert: jest.fn()
  }))
}));

jest.mock('../../utils/tagExtractor', () => ({
  extractTags: jest.fn(() => [])
}));

jest.mock('../../assets/media', () => ({
  emojiMap: { crossError: '❌' }
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import {
  extractWorldIdFromMessage,
  extractAllWorldIdsFromMessage
} from './watchForVRCWorldLinks/worldExtraction';
import { extractAllWorldIds } from '../../utils/regex';

// Re-export the private helper by importing the module under test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractWorldIdFromAnywhere } = require('./crawlHistory');

const WRLD = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeMessage(overrides: Record<string, unknown> = {}): Message {
  return {
    id: 'msg-1',
    guildId: 'guild-1',
    channelId: 'chan-1',
    content: '',
    embeds: [],
    messageSnapshots: undefined,
    attachments: { values: () => [].values() as IterableIterator<never> },
    ...overrides
  } as unknown as Message;
}

describe('extractWorldIdFromAnywhere', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(null);
    (extractAllWorldIdsFromMessage as jest.Mock).mockResolvedValue([]);
    (extractAllWorldIds as jest.Mock).mockReturnValue([]);
  });

  it('resolves world ID from message content (including Twitter links)', async () => {
    (extractAllWorldIdsFromMessage as jest.Mock).mockResolvedValue([
      { worldId: WRLD, sourceContent: 'https://x.com/someuser/status/123' }
    ]);

    const result = await extractWorldIdFromAnywhere(
      makeMessage({ content: 'https://x.com/someuser/status/123' })
    );

    expect(result).toBe(WRLD);
    expect(extractAllWorldIdsFromMessage).toHaveBeenCalledWith(
      'https://x.com/someuser/status/123'
    );
  });

  it('falls back to embed URL when content has no world ID', async () => {
    (extractAllWorldIds as jest.Mock).mockImplementation((text: string) =>
      text.includes(WRLD) ? [WRLD] : []
    );

    const message = makeMessage({
      content: 'no world here',
      embeds: [{ url: `https://vrchat.com/home/world/${WRLD}` } as never]
    });

    const result = await extractWorldIdFromAnywhere(message);

    expect(result).toBe(WRLD);
  });

  it('resolves world ID from forwarded snapshot content', async () => {
    const snapshot = {
      content: 'forwarded tweet https://x.com/user/status/456',
      embeds: []
    };
    const message = makeMessage({
      content: '',
      messageSnapshots: {
        size: 1,
        values: () => [snapshot].values() as IterableIterator<never>
      } as never
    });

    (extractAllWorldIdsFromMessage as jest.Mock).mockImplementation(
      (content) =>
        content && content.includes('x.com')
          ? [{ worldId: WRLD, sourceContent: content }]
          : []
    );

    const result = await extractWorldIdFromAnywhere(message);

    expect(result).toBe(WRLD);
    expect(extractAllWorldIdsFromMessage).toHaveBeenCalledWith(
      'forwarded tweet https://x.com/user/status/456'
    );
  });

  it('extracts world ID from forwarded snapshot embed URL', async () => {
    (extractAllWorldIds as jest.Mock).mockImplementation((text: string) =>
      text.includes(WRLD) ? [WRLD] : []
    );

    const snapshot = {
      content: '',
      embeds: [{ url: `https://vrchat.com/home/world/${WRLD}` }]
    };
    const message = makeMessage({
      content: '',
      messageSnapshots: {
        size: 1,
        values: () => [snapshot].values() as IterableIterator<never>
      } as never
    });

    const result = await extractWorldIdFromAnywhere(message);

    expect(result).toBe(WRLD);
  });

  it('extracts world ID from attachment filename', async () => {
    (extractAllWorldIds as jest.Mock).mockImplementation((text: string) =>
      text.includes(WRLD) ? [WRLD] : []
    );

    const attachment = { name: `screenshot-${WRLD}.png` };
    const message = makeMessage({
      content: '',
      attachments: {
        values: () => [attachment].values() as IterableIterator<never>
      } as never
    });

    const result = await extractWorldIdFromAnywhere(message);

    expect(result).toBe(WRLD);
  });

  it('returns null when no world ID is present anywhere', async () => {
    const result = await extractWorldIdFromAnywhere(makeMessage());

    expect(result).toBeNull();
  });
});
