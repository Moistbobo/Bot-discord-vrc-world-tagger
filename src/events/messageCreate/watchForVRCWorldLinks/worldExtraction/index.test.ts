import {
  extractAllWorldIdsFromMessage,
  extractWorldIdFromMessage
} from './index';
import { api } from '../../../../utils/apiClient';
import { extractAllWorldIds } from '../../../../utils/regex';

jest.mock('../../../../utils/apiClient', () => ({
  api: {
    extractWorlds: jest.fn()
  }
}));

jest.mock('../../../../utils/regex', () => ({
  extractAllWorldIds: jest.fn()
}));

const extractWorldsMock = api.extractWorlds as jest.Mock;
const extractAllWorldIdsMock = extractAllWorldIds as jest.Mock;

const WRLD = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('extractAllWorldIdsFromMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts direct world IDs locally without calling the API', async () => {
    extractAllWorldIdsMock.mockReturnValue([WRLD]);

    const content = `Check out ${WRLD}`;
    const result = await extractAllWorldIdsFromMessage(content);

    expect(result).toEqual([{ worldId: WRLD, sourceContent: content }]);
    expect(extractWorldsMock).not.toHaveBeenCalled();
  });

  it('delegates to the API when the content contains a Twitter/X link', async () => {
    extractAllWorldIdsMock.mockReturnValue([]);
    extractWorldsMock.mockResolvedValue([
      { worldId: WRLD, sourceContent: 'https://x.com/u/1' }
    ]);

    const result = await extractAllWorldIdsFromMessage(
      'https://x.com/someuser/status/123'
    );

    expect(extractWorldsMock).toHaveBeenCalledWith(
      'https://x.com/someuser/status/123'
    );
    expect(result).toEqual([
      { worldId: WRLD, sourceContent: 'https://x.com/u/1' }
    ]);
  });

  it('delegates to the API when content has both a direct ID and a Twitter link', async () => {
    extractAllWorldIdsMock.mockReturnValue([WRLD]);
    extractWorldsMock.mockResolvedValue([
      { worldId: WRLD, sourceContent: `${WRLD} plus https://x.com/u/1` }
    ]);

    await extractAllWorldIdsFromMessage(`${WRLD} plus https://x.com/u/1`);

    expect(extractWorldsMock).toHaveBeenCalled();
  });
});

describe('extractWorldIdFromMessage', () => {
  it('returns the first world ID from the API result', async () => {
    extractWorldsMock.mockResolvedValue([
      { worldId: WRLD, sourceContent: 'https://x.com/u/1' }
    ]);

    const result = await extractWorldIdFromMessage('https://x.com/u/1');

    expect(result).toBe(WRLD);
  });

  it('returns null when nothing matches', async () => {
    extractAllWorldIdsMock.mockReturnValue([]);

    const result = await extractWorldIdFromMessage('no world here');

    expect(result).toBeNull();
  });
});
