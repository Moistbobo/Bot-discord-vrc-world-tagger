import { Message } from 'discord.js';
import { kvKeys } from '../../../utils/jsonAsDb/types';

jest.mock('../../../utils/jsonAsDb/handlers/persistentKvp', () => ({
  getValue: jest.fn(),
  setValue: jest.fn()
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

import {
  getValue,
  setValue
} from '../../../utils/jsonAsDb/handlers/persistentKvp';
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

  it('sets PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID when not yet tracked', async () => {
    (getValue as jest.Mock).mockResolvedValue(undefined);
    (setValue as jest.Mock).mockResolvedValue(true);

    const message = makeMessage();
    const result = await forceRefetchWorldFromMessage(message);

    expect(result).toBe(true);
    expect(getValue).toHaveBeenCalledWith(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      `${WRLD}-guild-1`
    );
    expect(setValue).toHaveBeenCalledWith(
      kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
      `${WRLD}-guild-1`,
      'msg-1'
    );
  });

  it('does not setValue when world is already tracked for guild', async () => {
    (getValue as jest.Mock).mockResolvedValue('older-msg');

    await forceRefetchWorldFromMessage(makeMessage());

    expect(getValue).toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('does not call getValue or setValue when guildId is missing', async () => {
    const message = { ...makeMessage(), guildId: null } as Message;
    await forceRefetchWorldFromMessage(message);

    expect(getValue).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('returns false when no world id in message', async () => {
    (extractWorldIdFromMessage as jest.Mock).mockResolvedValue(null);

    const result = await forceRefetchWorldFromMessage(makeMessage());

    expect(result).toBe(false);
    expect(getValue).not.toHaveBeenCalled();
  });
});
