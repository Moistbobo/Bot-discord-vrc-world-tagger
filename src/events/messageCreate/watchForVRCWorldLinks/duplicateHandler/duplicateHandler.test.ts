import { Message, SendableChannels } from 'discord.js';
import { kvKeys } from '../../../../utils/jsonAsDb/types';

// Mock persistentKvp handler (module may not exist physically, so mark virtual)
jest.mock(
  '../../../../utils/jsonAsDb/handlers/persistentKvp',
  () => {
    return {
      getValue: jest.fn(),
      setValue: jest.fn()
    };
  },
  { virtual: true }
);

// Optionally mock logger to silence output
jest.mock('../../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Use real emoji map (simple enough), fallback if needed
jest.mock('../../../../assets/icons', () => ({
  emojiMap: {
    recycle: '♻',
    actually: ':actually:',
    checkmark: '✅'
  }
}));

import {
  getValue,
  setValue
} from '../../../../utils/jsonAsDb/handlers/persistentKvp';
import { checkAndHandleDuplicate } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

describe('checkAndHandleDuplicate', () => {
  const baseMessage = {
    id: '444',
    guildId: '111',
    channelId: '222',
    react: jest.fn(async () => undefined),
    channel: {
      isSendable: () => true,
      send: jest.fn(async () => undefined)
    }
  } as unknown as Message;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true and informs duplicate when original message exists', async () => {
    asMock(getValue).mockResolvedValue('333'); // original message id

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_abc');

    expect(result).toBe(true);
    expect(getValue).toHaveBeenCalledWith(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      'wrld_abc-111'
    );
    expect(baseMessage.react).toHaveBeenCalledWith('♻');
    // Ensure a link containing guild/channel/message ids is sent
    const sent = (baseMessage.channel as any).send as jest.Mock;
    expect(sent).toHaveBeenCalledTimes(1);
    const [sentMsg] = sent.mock.calls[0];
    expect(String(sentMsg)).toContain('/111/222/333');
  });

  it('returns false and saves original message when not a duplicate', async () => {
    asMock(getValue).mockResolvedValue(undefined);
    asMock(setValue).mockResolvedValue(true);

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_new');

    expect(result).toBe(false);
    expect(setValue).toHaveBeenCalledWith(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      'wrld_new-111',
      '444'
    );
    // Should not send duplicate notice nor react when saving new
    expect(baseMessage.react).not.toHaveBeenCalled();
    const sent = (baseMessage.channel as any).send as jest.Mock;
    expect(sent).not.toHaveBeenCalled();
  });

  it('skips sending message if channel not sendable but still returns true for duplicate', async () => {
    asMock(getValue).mockResolvedValue('999');

    const nonSendableMessage = {
      ...baseMessage,
      channel: { isSendable: () => false, send: jest.fn() }
    } as unknown as Message;

    const result = await checkAndHandleDuplicate(
      nonSendableMessage,
      'wrld_dup'
    );

    expect(result).toBe(true);
    expect(nonSendableMessage.react).toHaveBeenCalledWith('♻');
    const sent = (nonSendableMessage.channel as SendableChannels)
      .send as jest.Mock;
    expect(sent).not.toHaveBeenCalled();
  });

  it('suppresses user-facing responses when silent mode is enabled', async () => {
    asMock(getValue).mockResolvedValue('333'); // original message id

    const result = await checkAndHandleDuplicate(baseMessage, 'wrld_abc', true);

    expect(result).toBe(true);
    expect(getValue).toHaveBeenCalledWith(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      'wrld_abc-111'
    );
    // Should not react or send messages in silent mode
    expect(baseMessage.react).not.toHaveBeenCalled();
    const sent = (baseMessage.channel as any).send as jest.Mock;
    expect(sent).not.toHaveBeenCalled();
  });
});
