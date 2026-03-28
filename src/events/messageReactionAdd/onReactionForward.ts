import { messageLink, MessageReaction, User } from 'discord.js';
import logger from '../../utils/logger';
import { get } from '../../utils/jsonAsDb';
import { has, add } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import {
  getEmojiKey,
  resolveForwardTargetChannelId,
  type ReactionForwardConfig
} from '../../utils/discord/reactionEmoji';

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

  const isWatchedForReacts = await has(
    kvKeys.WATCHED_REACTION_CHANNELS,
    channelId
  );
  if (!isWatchedForReacts) return;

  const alreadyForwarded = await has(
    kvKeys.REACTION_FORWARDED_MESSAGE_IDS,
    message.id
  );
  if (alreadyForwarded) return;

  const config =
    (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) || {};
  const emojiKey = getEmojiKey(reaction);
  const targetChannelId = resolveForwardTargetChannelId(reaction, config);

  if (!targetChannelId) return;

  // Don't forward to the same channel (prevents infinite loop when reacting to a forwarded message)
  if (targetChannelId === channelId) return;

  const targetChannel = message.guild?.channels.cache.get(targetChannelId);
  if (!targetChannel?.isSendable()) {
    logger.warn(
      `Reaction forward target channel ${targetChannelId} is not available or not sendable`
    );
    return;
  }

  logger.info(
    `Forwarding message ${message.id} from channel ${channelId} to ${targetChannelId} (triggered by emoji ${emojiKey})`
  );

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
