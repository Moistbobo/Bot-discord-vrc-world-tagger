import type { Mock } from 'vitest';
import {
  BATCH_SIZE,
  crawlHighPriorityChannel,
  MAX_MESSAGES,
  RATE_LIMIT_DELAY
} from './highPriorityCrawl';

import * as jsonAsDb from './jsonAsDb';
import * as persistentList from './jsonAsDb/handlers/persistentList';
import * as highPriorityChannel from './highPriorityChannel';
import * as apiClient from './apiClient';
import * as crawlHistory from '../events/messageCreate/crawlHistory';

vi.mock('./jsonAsDb', () => ({
  get: vi.fn()
}));

vi.mock('./jsonAsDb/handlers/persistentList', () => ({
  getFirst: vi.fn()
}));

vi.mock('./highPriorityChannel', () => ({
  recordHighPriorityForward: vi.fn(),
  takeHighPriorityForward: vi.fn()
}));

vi.mock('./apiClient', () => ({
  api: {
    setHighPriority: vi.fn(),
    removeHighPriority: vi.fn()
  },
  isApiError: vi.fn()
}));

vi.mock('../events/messageCreate/crawlHistory', () => ({
  extractWorldIdFromAnywhere: vi.fn()
}));

const { get } = jsonAsDb as unknown as { get: Mock };
const { getFirst } = persistentList as unknown as { getFirst: Mock };
const { recordHighPriorityForward, takeHighPriorityForward } =
  highPriorityChannel as unknown as {
    recordHighPriorityForward: Mock;
    takeHighPriorityForward: Mock;
  };
const { api } = apiClient as unknown as {
  api: { setHighPriority: Mock; removeHighPriority: Mock };
};
const { isApiError } = apiClient as unknown as { isApiError: Mock };
const { extractWorldIdFromAnywhere } = crawlHistory as unknown as {
  extractWorldIdFromAnywhere: Mock;
};

const HP_CHANNEL = 'hp-chan';
const GUILD_ID = 'guild1';
const WORLD_ID = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const makeMessage = (id: string, overrides: Partial<any> = {}) =>
  ({ id, guildId: GUILD_ID, content: '', embeds: [], ...overrides }) as any;

const makeChannel = (overrides: Partial<any> = {}) => ({
  isTextBased: () => true,
  guildId: GUILD_ID,
  messages: { fetch: vi.fn() },
  ...overrides
});

const makeClient = (channel: any) => ({
  channels: { fetch: vi.fn().mockResolvedValue(channel) }
});

const makeBatch = (prefix: string, count: number) => {
  const batch = new Map<string, any>();
  for (let i = 0; i < count; i++) {
    const id = `${prefix}-${i}`;
    batch.set(id, makeMessage(id));
  }
  return batch;
};

describe('crawlHighPriorityChannel', () => {
  beforeEach(() => {
    getFirst.mockReset();
    get.mockReset();
    recordHighPriorityForward.mockReset();
    takeHighPriorityForward.mockReset();
    api.setHighPriority.mockReset();
    api.removeHighPriority.mockReset();
    isApiError.mockReset();
    extractWorldIdFromAnywhere.mockReset();
  });

  it('returns not-configured when no high priority channel is set', async () => {
    getFirst.mockResolvedValue(undefined);
    const client = { channels: { fetch: vi.fn() } };

    const result = await crawlHighPriorityChannel(client as any);

    expect(result).toEqual({
      ok: false,
      reason: 'not-configured',
      scanned: 0,
      added: 0,
      removed: 0,
      truncated: false
    });
    expect(client.channels.fetch).not.toHaveBeenCalled();
    expect(api.setHighPriority).not.toHaveBeenCalled();
    expect(api.removeHighPriority).not.toHaveBeenCalled();
  });

  it('returns not-found when the configured channel is missing', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const client = { channels: { fetch: vi.fn().mockResolvedValue(null) } };

    const result = await crawlHighPriorityChannel(client as any);

    expect(result).toEqual({
      ok: false,
      reason: 'not-found',
      scanned: 0,
      added: 0,
      removed: 0,
      truncated: false
    });
  });

  it('returns not-found for a channel without a guild (DM)', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel({ guildId: null });
    const client = makeClient(channel);

    const result = await crawlHighPriorityChannel(client as any);

    expect(result.reason).toBe('not-found');
  });

  it('marks a found world high priority and records it when absent from the map', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(
      new Map([['m1', makeMessage('m1')]])
    );
    const client = makeClient(channel);
    get.mockResolvedValue(undefined);
    extractWorldIdFromAnywhere.mockResolvedValue(WORLD_ID);

    const result = await crawlHighPriorityChannel(client as any);

    expect(result).toEqual({
      ok: true,
      scanned: 1,
      added: 1,
      removed: 0,
      truncated: false
    });
    expect(api.setHighPriority).toHaveBeenCalledWith(WORLD_ID, GUILD_ID);
    expect(recordHighPriorityForward).toHaveBeenCalledWith('m1', {
      worldId: WORLD_ID,
      guildId: GUILD_ID
    });
  });

  it('removes a recorded forward whose message vanished when the scan is complete', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(new Map());
    const client = makeClient(channel);
    get.mockResolvedValue({
      'vanished-1': JSON.stringify({ worldId: WORLD_ID, guildId: GUILD_ID })
    });

    const result = await crawlHighPriorityChannel(client as any);

    expect(result).toEqual({
      ok: true,
      scanned: 0,
      added: 0,
      removed: 1,
      truncated: false
    });
    expect(api.removeHighPriority).toHaveBeenCalledWith(WORLD_ID, GUILD_ID);
    expect(takeHighPriorityForward).toHaveBeenCalledWith('vanished-1');
  });

  it('returns ok with zeros on an empty channel', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(new Map());
    const client = makeClient(channel);
    get.mockResolvedValue(undefined);

    const result = await crawlHighPriorityChannel(client as any);

    expect(result).toEqual({
      ok: true,
      scanned: 0,
      added: 0,
      removed: 0,
      truncated: false
    });
    expect(api.setHighPriority).not.toHaveBeenCalled();
    expect(api.removeHighPriority).not.toHaveBeenCalled();
    expect(recordHighPriorityForward).not.toHaveBeenCalled();
    expect(takeHighPriorityForward).not.toHaveBeenCalled();
  });

  it('skips unparseable recorded entries without throwing', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(new Map());
    const client = makeClient(channel);
    get.mockResolvedValue({ 'bad-1': 'not-json{{{' });

    await expect(
      crawlHighPriorityChannel(client as any)
    ).resolves.toMatchObject({ ok: true });
    expect(api.removeHighPriority).not.toHaveBeenCalled();
    expect(takeHighPriorityForward).not.toHaveBeenCalled();
  });

  it('cleans the map entry when removal hits a 404 noop', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(new Map());
    const client = makeClient(channel);
    get.mockResolvedValue({
      'vanished-1': JSON.stringify({ worldId: WORLD_ID, guildId: GUILD_ID })
    });
    api.removeHighPriority.mockRejectedValue({ status: 404 });
    isApiError.mockImplementation((error: any) => error?.status !== undefined);

    const result = await crawlHighPriorityChannel(client as any);

    expect(result.removed).toBe(1);
    expect(takeHighPriorityForward).toHaveBeenCalledWith('vanished-1');
  });

  it('keeps the map entry when removal fails with a non-404 error', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    const channel = makeChannel();
    channel.messages.fetch.mockResolvedValue(new Map());
    const client = makeClient(channel);
    get.mockResolvedValue({
      'vanished-1': JSON.stringify({ worldId: WORLD_ID, guildId: GUILD_ID })
    });
    api.removeHighPriority.mockRejectedValue({ status: 500 });
    isApiError.mockImplementation((error: any) => error?.status !== undefined);

    const result = await crawlHighPriorityChannel(client as any);

    expect(result.removed).toBe(0);
    expect(takeHighPriorityForward).not.toHaveBeenCalled();
  });

  it('rejects a second crawl while one is running', async () => {
    getFirst.mockResolvedValue(HP_CHANNEL);
    let releaseFetch: (value: any) => void = () => {};
    const gate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const channel = makeChannel();
    channel.messages.fetch.mockReturnValue(gate);
    const client = makeClient(channel);
    get.mockResolvedValue(undefined);

    const first = crawlHighPriorityChannel(client as any);
    const second = await crawlHighPriorityChannel(client as any);

    expect(second).toEqual({
      ok: false,
      reason: 'error',
      scanned: 0,
      added: 0,
      removed: 0,
      truncated: false
    });
    releaseFetch(new Map());
    await first;
  });

  it('skips the removal pass when the message cap is hit', async () => {
    vi.useFakeTimers();
    try {
      getFirst.mockResolvedValue(HP_CHANNEL);
      const channel = makeChannel();
      channel.messages.fetch.mockResolvedValue(
        makeBatch('cap-msg', BATCH_SIZE)
      );
      const client = makeClient(channel);
      get.mockResolvedValue({
        'vanished-1': JSON.stringify({
          worldId: WORLD_ID,
          guildId: GUILD_ID
        })
      });
      extractWorldIdFromAnywhere.mockResolvedValue(null);

      const crawlPromise = crawlHighPriorityChannel(client as any);
      await vi.advanceTimersByTimeAsync(RATE_LIMIT_DELAY * 60);
      const result = await crawlPromise;

      expect(result).toEqual({
        ok: true,
        scanned: MAX_MESSAGES,
        added: 0,
        removed: 0,
        truncated: true
      });
      expect(api.removeHighPriority).not.toHaveBeenCalled();
      expect(takeHighPriorityForward).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
