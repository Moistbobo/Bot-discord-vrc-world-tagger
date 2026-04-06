import { Message, MessageReaction, User } from 'discord.js';
import logger from '../../utils/logger';
import { add, has } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import { emojiMap } from '../../assets/media';
import { shouldIgnoreOwnBotMessage } from '../../botFilters';
import { forceRefetchWorldFromMessage } from '../messageCreate/watchForVRCWorldLinks';

export const onReactionForceRefetch = async (
  reaction: MessageReaction,
  user: User
): Promise<void> => {
  if (user.bot) return;

  const emojiName = reaction.emoji.name ?? '';
  if (emojiName !== emojiMap.recycle) return;

  let message: Message;
  try {
    message = reaction.message.partial
      ? await reaction.message.fetch()
      : (reaction.message as Message);
  } catch (error) {
    logger.error('Failed to fetch partial message for force refetch:', error);
    return;
  }

  // Skip this bot's own replies; allow webhooks and other bots (original link posts).
  if (
    shouldIgnoreOwnBotMessage(
      message.author.id,
      reaction.client.user?.id
    )
  ) {
    return;
  }

  const isWatched = await has(kvKeys.WATCHED_CHANNELS, message.channelId);
  if (!isWatched) return;

  // Uncomment to prevent multiple refetches of the same message
  // const alreadyForceRefetched = await has(
  //   kvKeys.FORCE_REFETCHED_MESSAGE_IDS,
  //   message.id
  // );
  // if (alreadyForceRefetched) return;

  try {
    const didRefetch = await forceRefetchWorldFromMessage(message);
    if (didRefetch) {
      const addResult = await add(
        kvKeys.FORCE_REFETCHED_MESSAGE_IDS,
        message.id
      );
      if (!addResult.success) {
        logger.error(
          `Failed to record force-refetched message id ${message.id}:`,
          addResult.error
        );
      }
      try {
        await message.react(emojiMap.checkmark);
      } catch (err) {
        logger.debug('Failed to react with checkmark after refetch:', err);
      }
    } else {
      try {
        await message.react(emojiMap.crossError);
      } catch (err) {
        logger.debug(
          'Failed to react with crossError after refetch miss:',
          err
        );
      }
    }
  } catch (error) {
    logger.error('Force refetch failed:', error);
    try {
      await message.react(emojiMap.crossError);
    } catch (err) {
      logger.debug('Failed to react with crossError after refetch error:', err);
    }
  }
};
