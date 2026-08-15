import { Message, MessageReaction, User } from 'discord.js';
import logger from '../../utils/logger';
import { get } from '../../utils/jsonAsDb';
import { getAll, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import {
  getEmojiKey,
  resolveForwardTargetChannelId,
  type ReactionForwardConfig
} from '../../utils/discord/reactionEmoji';
import { isHighPriorityChannel } from '../../utils/highPriorityChannel';

function reactionMatchesDeleteEmoji(
  reaction: MessageReaction,
  deleteEmojis: string[]
): boolean {
  const emojiKey = getEmojiKey(reaction);
  if (deleteEmojis.includes(emojiKey)) return true;
  if (
    reaction.emoji.name &&
    deleteEmojis.includes(`:${reaction.emoji.name}:`)
  ) {
    return true;
  }
  return false;
}

export const onReactionToDelete = async (
  reaction: MessageReaction,
  user: User
): Promise<void> => {
  if (user.bot) return;

  try {
    if (reaction.message.partial) {
      await reaction.message.fetch();
    }
  } catch (error) {
    logger.error('Failed to fetch partial message for reaction delete:', error);
    return;
  }

  const message = reaction.message as Message;
  const channelId = message.channelId;

  const isWatchedForReacts = await has(
    kvKeys.WATCHED_REACTION_CHANNELS,
    channelId
  );
  if (!isWatchedForReacts && !(await isHighPriorityChannel(channelId))) return;

  if (message.author?.id !== reaction.client.user?.id) return;

  const deleteEmojis = await getAll(kvKeys.REACT_TO_DELETE_EMOJIS);
  if (!reactionMatchesDeleteEmoji(reaction, deleteEmojis)) return;

  const forwardConfig =
    (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) || {};
  const forwardTarget = resolveForwardTargetChannelId(reaction, forwardConfig);
  const hasForwardMapping = forwardTarget !== undefined;

  if (hasForwardMapping) {
    const forwarded = await has(
      kvKeys.REACTION_FORWARDED_MESSAGE_IDS,
      message.id
    );
    if (!forwarded) return;
  }

  try {
    await message.delete();
  } catch (error) {
    logger.error(
      `Failed to delete message ${message.id} via react-to-delete:`,
      error
    );
  }
};
