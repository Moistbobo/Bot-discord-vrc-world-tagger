import { Message } from 'discord.js';

// Mock the world repository
jest.mock('../../../../utils/database/worldRepository', () => ({
  getWorldRepository: jest.fn()
}));

jest.mock('../../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../../assets/media', () => ({
  emojiMap: {
    recycle: '♻',
    actually: ':actually:',
    checkmark: '✅'
  }
}));

import { getWorldRepository } from '../../../../utils/database/worldRepository';
import { checkAndHandleDuplicate } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

describe('checkAndHandleDuplicate', () => {
  const baseMessage = {
    id: '444',
    guildId: '111',
    channelId: '222',
    react: jest.fn(async () => undefined),
    reply: jest.fn(async () => undefined),
    channel: {
      isSendable: () => true,
      send: jest.fn(async () => undefined)
    }
  } as unknown as Message & {
    reply: jest.MockedFunction<Message['reply']>;
  };

  const createMockRepo = (record: { messageId: string } | null) => ({
    getByWorldAndGuild: jest.fn(() => record)
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true and informs duplicate when original message exists', async () => {
    asMock(getWorldRepository).mockReturnValue(
      createMockRepo({ messageId: '333' })
    );

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_abc');

    expect(result).toBe(true);
    expect(baseMessage.react).toHaveBeenCalledWith('♻');
    expect(baseMessage.reply).toHaveBeenCalledTimes(1);
    const [replyOptions] = baseMessage.reply.mock.calls[0];
    expect(replyOptions).toEqual({
      allowedMentions: { repliedUser: false },
      content:
        ':actually: Uhm Ackhusally this is a duplicate of https://discord.com/channels/111/222/333\n-# Press the ♻ reaction to fetch world information anyway.'
    });
  });

  it('returns false when not a duplicate', async () => {
    asMock(getWorldRepository).mockReturnValue(createMockRepo(null));

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_new');

    expect(result).toBe(false);
    expect(baseMessage.react).not.toHaveBeenCalled();
    expect(baseMessage.reply).not.toHaveBeenCalled();
  });

  it('skips sending message if channel not sendable but still returns true for duplicate', async () => {
    asMock(getWorldRepository).mockReturnValue(
      createMockRepo({ messageId: '999' })
    );

    const nonSendableMessage = {
      ...baseMessage,
      channel: { isSendable: () => false, send: jest.fn() }
    } as unknown as Message & {
      reply: jest.MockedFunction<Message['reply']>;
    };

    const result = await checkAndHandleDuplicate(
      nonSendableMessage,
      'wrld_dup'
    );

    expect(result).toBe(true);
    expect(nonSendableMessage.react).toHaveBeenCalledWith('♻');
    expect(nonSendableMessage.reply).not.toHaveBeenCalled();
  });

  it('suppresses user-facing responses when silent mode is enabled', async () => {
    asMock(getWorldRepository).mockReturnValue(
      createMockRepo({ messageId: '333' })
    );

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_abc', true);

    expect(result).toBe(true);
    expect(baseMessage.react).not.toHaveBeenCalled();
    expect(baseMessage.reply).not.toHaveBeenCalled();
  });
});
