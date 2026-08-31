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

jest.mock('../../utils/apiClient', () => ({
  api: {
    getWorldIds: jest.fn().mockResolvedValue([]),
    setTags: jest.fn().mockResolvedValue({ updated: false, tags: [] }),
    setQuality: jest.fn().mockResolvedValue({ updated: false })
  }
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

jest.mock('../../utils/highPriorityCrawl', () => ({
  crawlHighPriorityChannel: jest.fn()
}));

import {
  extractWorldIdFromMessage,
  extractAllWorldIdsFromMessage
} from './watchForVRCWorldLinks/worldExtraction';
import { extractAllWorldIds } from '../../utils/regex';

// Re-export the private helper by importing the module under test.
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  crawlChannelHistory,
  extractWorldIdFromAnywhere
} = require('./crawlHistory');
const {
  crawlHighPriorityChannel: runCrawl
} = require('../../utils/highPriorityCrawl');
/* eslint-enable @typescript-eslint/no-require-imports */

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

function makeCommandMessage(content: string): {
  message: Message;
  send: jest.Mock;
} {
  const send = jest.fn().mockResolvedValue(undefined);
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
