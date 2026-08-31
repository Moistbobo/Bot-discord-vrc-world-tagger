import { onReactionForceRefetch } from './onReactionForceRefetch';
import type { Mock } from 'vitest';

import * as persistentList from '../../utils/jsonAsDb/handlers/persistentList';
import * as watchForVRCWorldLinks from '../messageCreate/watchForVRCWorldLinks';

vi.mock('../../utils/jsonAsDb/handlers/persistentList', () => ({
  has: vi.fn(),
  add: vi.fn()
}));

vi.mock('../messageCreate/watchForVRCWorldLinks', () => ({
  forceRefetchWorldFromMessage: vi.fn()
}));

vi.mock('../../assets/media', () => ({
  emojiMap: {
    recycle: '♻',
    checkmark: '✅',
    crossError: '❌',
    actually: '<:actually:1>',
    android: '<:android:1>',
    standalonewindows: '<:windows:1>',
    ios: '<:ios:1>'
  }
}));

const OUR_BOT_ID = 'our-bot-id';

const { has, add } = persistentList as unknown as {
  has: Mock;
  add: Mock;
};

const { forceRefetchWorldFromMessage } = watchForVRCWorldLinks as unknown as {
  forceRefetchWorldFromMessage: Mock;
};

const makeReaction = (overrides: Partial<any> = {}) => {
  const {
    emoji: emojiOverride,
    message: messageOverride,
    client: clientOverride,
    ...rest
  } = overrides;

  return {
    emoji: { name: '♻', ...emojiOverride },
    client: {
      user: { id: OUR_BOT_ID, ...clientOverride?.user }
    },
    message: {
      id: 'msg123',
      partial: false,
      fetch: vi.fn(),
      channelId: 'chan1',
      author: { id: 'human-1', bot: false },
      react: vi.fn(),
      ...messageOverride
    },
    ...rest
  } as any;
};

describe('onReactionForceRefetch', () => {
  beforeEach(() => {
    has.mockReset();
    add.mockReset();
    forceRefetchWorldFromMessage.mockReset();
  });

  it('ignores non-recycle emoji', async () => {
    const reaction = makeReaction({ emoji: { name: '✅' } });
    const user = { bot: false } as any;

    await onReactionForceRefetch(reaction, user);

    expect(has).not.toHaveBeenCalled();
    expect(forceRefetchWorldFromMessage).not.toHaveBeenCalled();
  });

  it('ignores messages authored by this bot', async () => {
    const reaction = makeReaction({
      message: { author: { id: OUR_BOT_ID, bot: true } }
    });
    const user = { bot: false } as any;

    await onReactionForceRefetch(reaction, user);

    expect(has).not.toHaveBeenCalled();
    expect(forceRefetchWorldFromMessage).not.toHaveBeenCalled();
  });

  it('refetches when message author is another bot (e.g. webhook)', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_CHANNELS')
    );
    add.mockResolvedValue({ success: true });
    forceRefetchWorldFromMessage.mockResolvedValue(true);

    const reaction = makeReaction({
      message: { author: { id: 'other-bot-id', bot: true } }
    });
    const user = { bot: false } as any;

    await onReactionForceRefetch(reaction, user);

    expect(forceRefetchWorldFromMessage).toHaveBeenCalledWith(reaction.message);
    expect(reaction.message.react).toHaveBeenCalledWith('✅');
  });

  it('only refetches in watched channels', async () => {
    has.mockResolvedValue(false);

    const reaction = makeReaction();
    const user = { bot: false } as any;

    await onReactionForceRefetch(reaction, user);

    expect(has).toHaveBeenCalledWith('WATCHED_CHANNELS', 'chan1');
    expect(forceRefetchWorldFromMessage).not.toHaveBeenCalled();
  });

  // it('skips refetch and does not react when message was already force-refetched', async () => {
  //   has.mockImplementation((key: string) =>
  //     Promise.resolve(
  //       key === 'WATCHED_CHANNELS' || key === 'FORCE_REFETCHED_MESSAGE_IDS'
  //     )
  //   );
  //   const reaction = makeReaction();
  //   const user = { bot: false } as any;
  //
  //   await onReactionForceRefetch(reaction, user);
  //
  //   expect(has).toHaveBeenCalledWith(
  //     'FORCE_REFETCHED_MESSAGE_IDS',
  //     reaction.message.id
  //   );
  //   expect(forceRefetchWorldFromMessage).not.toHaveBeenCalled();
  //   expect(reaction.message.react).not.toHaveBeenCalled();
  // });

  it('calls refetch with skip-duplicate path when watched', async () => {
    has.mockImplementation((key: string) =>
      Promise.resolve(key === 'WATCHED_CHANNELS')
    );
    add.mockResolvedValue({ success: true });
    forceRefetchWorldFromMessage.mockResolvedValue(true);

    const reaction = makeReaction();
    const user = { bot: false } as any;

    await onReactionForceRefetch(reaction, user);

    expect(forceRefetchWorldFromMessage).toHaveBeenCalledWith(reaction.message);
    expect(add).toHaveBeenCalledWith(
      'FORCE_REFETCHED_MESSAGE_IDS',
      reaction.message.id
    );
    expect(reaction.message.react).toHaveBeenCalledWith('✅');
  });
});
