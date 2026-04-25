import { onReactionUndoWorldTag } from './onReactionUndoWorldTag';
import { emojiMap } from '../../assets/media';

jest.mock('../messageCreate/watchForVRCWorldLinks/worldData', () => ({
  fetchWorldData: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: jest.fn(),
  remove: jest.fn()
}));

jest.mock('../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  removeValue: jest.fn()
}));

const { has, remove } = jest.requireMock(
  '../../utils/jsonAsDb/handlers/persistentList'
) as { has: jest.Mock; remove: jest.Mock };
const { removeValue } = jest.requireMock(
  '../../utils/jsonAsDb/handlers/persistentKvp'
) as { removeValue: jest.Mock };
const { fetchWorldData } = jest.requireMock(
  '../messageCreate/watchForVRCWorldLinks/worldData'
) as { fetchWorldData: jest.Mock };

const BOT_ID = 'bot-user-1';
const WORLD_ID = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WORLD_URL = `https://vrchat.com/home/world/${WORLD_ID}`;

const makeReaction = (overrides: Partial<any> = {}) => {
  const { message: messageOverride, ...rest } = overrides;
  const channelSend = jest.fn().mockResolvedValue(undefined);
  return {
    emoji: { name: emojiMap.undo, id: null, identifier: emojiMap.undo },
    message: {
      id: 'bot-reply-msg',
      partial: false,
      fetch: jest.fn(),
      channelId: 'chan1',
      guildId: 'guild1',
      author: { id: BOT_ID, bot: true },
      embeds: [{ url: WORLD_URL }],
      content: '',
      delete: jest.fn().mockResolvedValue(undefined),
      channel: {
        isSendable: () => true,
        send: channelSend
      },
      ...messageOverride
    },
    client: { user: { id: BOT_ID } },
    ...rest
  } as any;
};

describe('onReactionUndoWorldTag', () => {
  beforeEach(() => {
    has.mockReset();
    remove.mockReset();
    removeValue.mockReset();
    fetchWorldData.mockReset();
    remove.mockResolvedValue({ success: true });
    removeValue.mockResolvedValue(true);
    fetchWorldData.mockResolvedValue({
      name: 'Test World',
      authorName: 'Author',
      imageUrl: 'https://img.example/world.png'
    });
  });

  it('ignores bot users', async () => {
    const reaction = makeReaction();
    await onReactionUndoWorldTag(reaction, { bot: true } as any);
    expect(has).not.toHaveBeenCalled();
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('ignores non-undo emoji', async () => {
    const reaction = makeReaction({
      emoji: { name: '✅', id: null, identifier: '✅' }
    });
    await onReactionUndoWorldTag(reaction, { bot: false } as any);
    expect(has).not.toHaveBeenCalled();
  });

  it('ignores when channel is not watched for reacts', async () => {
    has.mockResolvedValue(false);
    const reaction = makeReaction();
    await onReactionUndoWorldTag(reaction, { bot: false } as any);
    expect(reaction.message.delete).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('ignores non-bot message authors', async () => {
    has.mockResolvedValue(true);
    const reaction = makeReaction({
      message: { author: { id: 'human', bot: false } }
    });
    await onReactionUndoWorldTag(reaction, { bot: false } as any);
    expect(reaction.message.delete).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('does nothing when no world id can be resolved', async () => {
    has.mockResolvedValue(true);
    const reaction = makeReaction({
      message: { embeds: [], content: 'no world here' }
    });
    await onReactionUndoWorldTag(reaction, { bot: false } as any);
    expect(remove).not.toHaveBeenCalled();
    expect(reaction.message.delete).not.toHaveBeenCalled();
  });

  it('removes db entries and deletes bot message', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_REACTION_CHANNELS')
    );
    const reaction = makeReaction();
    await onReactionUndoWorldTag(reaction, { bot: false } as any);

    expect(remove).toHaveBeenCalledWith('PROCESSED_WORLDS', WORLD_ID);
    expect(removeValue).toHaveBeenCalledWith(
      'PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID',
      `${WORLD_ID}-guild1`
    );
    expect(remove).toHaveBeenCalledWith(
      'REACTION_FORWARDED_MESSAGE_IDS',
      'bot-reply-msg'
    );
    expect(reaction.message.delete).toHaveBeenCalled();
    expect(fetchWorldData).toHaveBeenCalledWith(WORLD_ID);
    expect(reaction.message.channel.send).toHaveBeenCalledWith({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            color: 0xed4245,
            title: 'Test World by Author',
            url: WORLD_URL
          })
        })
      ])
    });
  });
});
