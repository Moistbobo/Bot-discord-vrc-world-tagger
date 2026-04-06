/** True when the author is this bot; such messages must not be processed (e.g. avoid self-trigger loops). */
export function shouldIgnoreOwnBotMessage(
  authorId: string,
  botUserId: string | null | undefined
): boolean {
  return botUserId != null && authorId === botUserId;
}
