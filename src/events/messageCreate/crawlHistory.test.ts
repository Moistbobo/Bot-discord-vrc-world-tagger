import { Message } from 'discord.js';
import type { Mock } from 'vitest';

vi.mock('./watchForVRCWorldLinks/worldExtraction', () => ({
  extractWorldIdFromMessage: vi.fn(),
  extractAllWorldIdsFromMessage: vi.fn()
}));

vi.mock('./watchForVRCWorldLinks', () => ({
  buildTagSource: vi.fn(() => ''),
  findAllWorldMatches: vi.fn(() => Promise.resolve([])),
  processWorldId: vi.fn()
}));

vi.mock('../../utils/regex', () => ({
  extractWorldId: vi.fn(),
  extractAllWorldIds: vi.fn()
}));

vi.mock('../../utils/jsonAsDb/index', () => ({
  set: vi.fn(),
  get: vi.fn()
}));

vi.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  getAll: vi.fn()
}));

vi.mock('../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  getValue: vi.fn()
}));

vi.mock('../../utils/apiClient', () => ({
  api: {
    getWorldPairs: vi.fn().mockResolvedValue([]),
    setTags: vi.fn().mockResolvedValue({ updated: false, tags: [] }),
    setQuality: vi.fn().mockResolvedValue({ updated: false })
  }
}));

vi.mock('../../assets/media', () => ({
  emojiMap: { crossError: '❌' }
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../utils/highPriorityCrawl', () => ({
  crawlHighPriorityChannel: vi.fn()
}));

import {
  extractWorldIdFromMessage,
  extractAllWorldIdsFromMessage
} from './watchForVRCWorldLinks/worldExtraction';
import { extractAllWorldIds } from '../../utils/regex';

// Re-export the private helper by importing the module under test.
import * as crawlHistory from './crawlHistory';
import * as highPriorityCrawl from '../../utils/highPriorityCrawl';

const { crawlChannelHistory, extractWorldIdFromAnywhere } = crawlHistory;
const { crawlHighPriorityChannel: runCrawl } = highPriorityCrawl as unknown as {
  crawlHighPriorityChannel: Mock;
};

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
    vi.clearAllMocks();
    (extractWorldIdFromMessage as Mock).mockResolvedValue(null);
    (extractAllWorldIdsFromMessage as Mock).mockResolvedValue([]);
    (extractAllWorldIds as Mock).mockReturnValue([]);
  });

  it('resolves world ID from message content (including Twitter links)', async () => {
    (extractAllWorldIdsFromMessage as Mock).mockResolvedValue([
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
    (extractAllWorldIds as Mock).mockImplementation((text: string) =>
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

    (extractAllWorldIdsFromMessage as Mock).mockImplementation((content) =>
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
    (extractAllWorldIds as Mock).mockImplementation((text: string) =>
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
    (extractAllWorldIds as Mock).mockImplementation((text: string) =>
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

function makeCommandMessage(content: string): {
  message: Message;
  send: Mock;
} {
  const send = vi.fn().mockResolvedValue(undefined);
  const message = {
    id: 'msg-1',
    guildId: 'guild-1',
    channelId: 'chan-1',
    content,
    client: {},
    mentions: { channels: { first: () => undefined } },
    channel: { isSendable: () => true, send }
  } as unknown as Message;
  return { message, send };
}

describe('.crawlHistory --highPriority', () => {
  beforeEach(() => {
    runCrawl.mockReset();
  });

  it('crawls the configured high priority channel without a channel mention', async () => {
    runCrawl.mockResolvedValue({
      ok: true,
      scanned: 3,
      added: 2,
      removed: 1,
      truncated: false
    });
    const { message, send } = makeCommandMessage(
      '.crawlHistory --highPriority'
    );

    await crawlChannelHistory(message);

    expect(runCrawl).toHaveBeenCalledWith(message.client);
    expect(send).toHaveBeenCalledWith(
      'Crawl complete: scanned 3 messages, added 2, removed 1.'
    );
  });

  it('replies when no high priority channel is configured', async () => {
    runCrawl.mockResolvedValue({
      ok: false,
      reason: 'not-configured',
      scanned: 0,
      added: 0,
      removed: 0,
      truncated: false
    });
    const { message, send } = makeCommandMessage(
      '.crawlHistory --highPriority'
    );

    await crawlChannelHistory(message);

    expect(send).toHaveBeenCalledWith(
      'No high priority channel is configured. Use `.setHighPriorityChannel #channel` first.'
    );
  });

  it('notes the message cap when the crawl was truncated', async () => {
    runCrawl.mockResolvedValue({
      ok: true,
      scanned: 3,
      added: 2,
      removed: 1,
      truncated: true
    });
    const { message, send } = makeCommandMessage(
      '.crawlHistory --highPriority'
    );

    await crawlChannelHistory(message);

    expect(send).toHaveBeenCalledWith(
      'Crawl complete: scanned 3 messages, added 2, removed 1. (capped at 5000 messages — run again or increase the cap)'
    );
  });

  it('falls through to the usage message when combined with --tags', async () => {
    const { message, send } = makeCommandMessage(
      '.crawlHistory --highPriority --tags'
    );

    await crawlChannelHistory(message);

    expect(runCrawl).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('--highPriority')
    );
  });
});
