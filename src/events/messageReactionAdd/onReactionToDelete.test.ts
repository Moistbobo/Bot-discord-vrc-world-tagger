import { onReactionToDelete } from './onReactionToDelete';

jest.mock('../../utils/jsonAsDb', () => ({
  get: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  getAll: jest.fn(),
  has: jest.fn()
}));

jest.mock('../../utils/highPriorityChannel', () => ({
  isHighPriorityChannel: jest.fn()
}));

const { get } = jest.requireMock('../../utils/jsonAsDb') as { get: jest.Mock };
const { getAll, has } = jest.requireMock(
  '../../utils/jsonAsDb/handlers/persistentList'
) as { getAll: jest.Mock; has: jest.Mock };
const { isHighPriorityChannel } = jest.requireMock(
  '../../utils/highPriorityChannel'
) as { isHighPriorityChannel: jest.Mock };

const BOT_ID = 'bot-user-1';

const makeReaction = (overrides: Partial<any> = {}) => {
  const { message: messageOverride, ...rest } = overrides;
  return {
    emoji: { name: '🗑️', id: null, identifier: undefined },
    message: {
      id: 'msg123',
      partial: false,
      fetch: jest.fn(),
      channelId: 'chan1',
      author: { id: BOT_ID, bot: true },
      delete: jest.fn().mockResolvedValue(undefined),
      ...messageOverride
    },
    client: { user: { id: BOT_ID } },
    ...rest
  } as any;
};

describe('onReactionToDelete', () => {
  beforeEach(() => {
    get.mockReset();
    getAll.mockReset();
    has.mockReset();
    isHighPriorityChannel.mockReset();
    get.mockResolvedValue({});
    getAll.mockResolvedValue(['🗑️']);
    isHighPriorityChannel.mockResolvedValue(false);
  });

  it('ignores bot users', async () => {
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: true } as any);
    expect(has).not.toHaveBeenCalled();
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('ignores non-bot message authors', async () => {
    has.mockResolvedValue(true);
    const reaction = makeReaction({
      message: { author: { id: 'human', bot: false } }
    });
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('ignores when channel is not watched for reacts', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key !== 'WATCHED_REACTION_CHANNELS')
    );
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('deletes bot message in the high-priority channel without watchReacts registration', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'REACTION_FORWARDED_MESSAGE_IDS')
    );
    isHighPriorityChannel.mockResolvedValue(true);
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(isHighPriorityChannel).toHaveBeenCalledWith('chan1');
    expect(reaction.message.delete).toHaveBeenCalled();
  });

  it('ignores when emoji is not in delete list', async () => {
    has.mockResolvedValue(true);
    getAll.mockResolvedValue(['✅']);
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('deletes bot message for delete-only emoji (no forward mapping)', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_REACTION_CHANNELS')
    );
    get.mockResolvedValue({});
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(reaction.message.delete).toHaveBeenCalled();
  });

  it('does not delete when emoji has forward mapping but message was not forwarded', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_REACTION_CHANNELS')
    );
    get.mockResolvedValue({ '🗑️': 'other-channel' });
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(has).toHaveBeenCalledWith(
      'REACTION_FORWARDED_MESSAGE_IDS',
      reaction.message.id
    );
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('deletes when forward mapping exists and message id is recorded as forwarded', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'WATCHED_REACTION_CHANNELS' ||
          key === 'REACTION_FORWARDED_MESSAGE_IDS'
      )
    );
    get.mockResolvedValue({ '🗑️': 'other-channel' });
    const reaction = makeReaction();
    await onReactionToDelete(reaction, { bot: false } as any);
    expect(reaction.message.delete).toHaveBeenCalled();
  });
});
