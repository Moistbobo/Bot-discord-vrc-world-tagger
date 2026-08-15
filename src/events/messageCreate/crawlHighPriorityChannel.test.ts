import crawlHighPriorityChannel from './crawlHighPriorityChannel';

jest.mock('../../utils/highPriorityCrawl', () => ({
  crawlHighPriorityChannel: jest.fn()
}));

const { crawlHighPriorityChannel: runCrawl } = jest.requireMock(
  '../../utils/highPriorityCrawl'
) as { crawlHighPriorityChannel: jest.Mock };

const makeMessage = () => {
  const send = jest.fn().mockResolvedValue(undefined);
  return {
    client: {},
    channel: { isSendable: () => true, send }
  } as any;
};

const makeResult = (overrides: Partial<any> = {}) => ({
  ok: true,
  scanned: 0,
  added: 0,
  removed: 0,
  truncated: false,
  ...overrides
});

describe('crawlHighPriorityChannel command', () => {
  beforeEach(() => {
    runCrawl.mockReset();
  });

  it('tells the user when no high priority channel is configured', async () => {
    runCrawl.mockResolvedValue(
      makeResult({ ok: false, reason: 'not-configured' })
    );
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'No high priority channel is configured. Use `.setHighPriorityChannel #channel` first.'
    );
  });

  it('replies with the crawl summary', async () => {
    runCrawl.mockResolvedValue(
      makeResult({ scanned: 42, added: 3, removed: 1 })
    );
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'Crawl complete: scanned 42 messages, added 3, removed 1.'
    );
  });

  it('notes the message cap when the crawl was truncated', async () => {
    runCrawl.mockResolvedValue(
      makeResult({ scanned: 5000, added: 2, truncated: true })
    );
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'Crawl complete: scanned 5000 messages, added 2, removed 0. (capped at 5000 messages — run again or increase the cap)'
    );
  });

  it('reports a missing channel', async () => {
    runCrawl.mockResolvedValue(makeResult({ ok: false, reason: 'not-found' }));
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'The configured high priority channel could not be found.'
    );
  });

  it('reports when a crawl is already in progress', async () => {
    runCrawl.mockResolvedValue(makeResult({ ok: false, reason: 'error' }));
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'A high priority channel crawl is already in progress. Try again shortly.'
    );
  });

  it('reports failure when the crawl throws', async () => {
    runCrawl.mockRejectedValue(new Error('boom'));
    const message = makeMessage();

    await crawlHighPriorityChannel(message);

    expect(message.channel.send).toHaveBeenCalledWith(
      'Failed to crawl the high priority channel. Please try again.'
    );
  });
});
