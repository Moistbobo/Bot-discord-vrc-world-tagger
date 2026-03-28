import { MessageReaction } from 'discord.js';

export type ReactionForwardConfig = Record<string, string>;

/**
 * Resolve the emoji key used in REACTION_FORWARD_CHANNELS / delete lists.
 * Unicode: reaction.emoji.name (e.g. "😀")
 * Custom: <:name:id> from reaction.emoji.identifier
 */
export function getEmojiKey(reaction: MessageReaction): string {
  if (reaction.emoji.id) {
    return `<:${reaction.emoji.identifier}>`;
  }
  return reaction.emoji.name ?? '';
}

/**
 * Look up forwarding target channel id for this reaction's emoji in config.
 * Matches onReactionForward (including :name: fallback for custom emojis).
 */
export function resolveForwardTargetChannelId(
  reaction: MessageReaction,
  config: ReactionForwardConfig
): string | undefined {
  const emojiKey = getEmojiKey(reaction);
  let targetChannelId = config[emojiKey];
  if (!targetChannelId && reaction.emoji.name) {
    targetChannelId = config[`:${reaction.emoji.name}:`];
  }
  return targetChannelId;
}
