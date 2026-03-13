import { messageLink, MessageReaction, User } from 'discord.js';
import logger from '../../utils/logger';
import { get } from '../../utils/jsonAsDb';
import { has, add } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

/**
 * Resolve the emoji key used in REACTION_FORWARD_CHANNELS.
 * Unicode: reaction.emoji.name (e.g. "😀")
 * Custom: reaction.emoji.identifier (e.g. "name:123456")
 */
function getEmojiKey(reaction: MessageReaction): string {
  if (reaction.emoji.id) {
    return reaction.emoji.identifier;
  }
  return reaction.emoji.name ?? '';
}

export const onReactionForward = async (
  reaction: MessageReaction,
  user: User
): Promise<void> => {
  if (user.bot) return;

  try {
    if (reaction.message.partial) {
      await reaction.message.fetch();
    }
  } catch (error) {
    logger.error(
      'Failed to fetch partial message for reaction forward:',
      error
    );
    return;
  }

  const message = reaction.message;
  const channelId = message.channelId;

  const isWatched = await has(kvKeys.WATCHED_CHANNELS, channelId);
  if (!isWatched) return;

  const alreadyForwarded = await has(
    kvKeys.REACTION_FORWARDED_MESSAGE_IDS,
    message.id
  );
  if (alreadyForwarded) return;

  const config =
    (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) || {};
  const emojiKey = getEmojiKey(reaction);
  let targetChannelId = config[`<:${emojiKey}>`];
  // Fallback: config may have been stored as :name: for custom emojis
  if (!targetChannelId && reaction.emoji.name) {
    targetChannelId = config[`:${reaction.emoji.name}:`];
  }

  if (!targetChannelId) return;

  const targetChannel = message.guild?.channels.cache.get(targetChannelId);
  if (!targetChannel?.isSendable()) {
    logger.warn(
      `Reaction forward target channel ${targetChannelId} is not available or not sendable`
    );
    return;
  }

  try {
    await message.forward(targetChannelId);
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 40005) {
      logger.warn(
        `Reaction forward to ${targetChannelId} hit upload limit, sending link fallback`
      );
      await targetChannel.send({
        content: `Original message omitted due to size. ${messageLink(message.channelId, message.id)}`
      });
    } else {
      logger.error(
        `Failed to forward message ${message.id} to channel ${targetChannelId}:`,
        error
      );
      return;
    }
  }

  const addResult = await add(
    kvKeys.REACTION_FORWARDED_MESSAGE_IDS,
    message.id
  );
  if (!addResult.success) {
    logger.error(
      `Failed to record forwarded message id ${message.id}:`,
      addResult.error
    );
  }
};
