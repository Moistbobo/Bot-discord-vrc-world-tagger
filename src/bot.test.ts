import { shouldIgnoreOwnBotMessage } from './botFilters';

/** Logic used by src/bot.ts MessageCreate (webhook/bot messages allowed; own bot ignored). */
describe('bot message gating (shouldIgnoreOwnBotMessage)', () => {
  const botId = '987654321098765432';

  it('ignores messages from this bot', () => {
    expect(shouldIgnoreOwnBotMessage(botId, botId)).toBe(true);
  });

  it('does not ignore messages from a human', () => {
    expect(shouldIgnoreOwnBotMessage('111111111111111111', botId)).toBe(false);
  });

  it('does not ignore messages from another bot or webhook user', () => {
    expect(shouldIgnoreOwnBotMessage('222222222222222222', botId)).toBe(false);
  });

  it('does not ignore when bot user id is unavailable', () => {
    expect(shouldIgnoreOwnBotMessage(botId, undefined)).toBe(false);
    expect(shouldIgnoreOwnBotMessage(botId, null)).toBe(false);
  });
});
