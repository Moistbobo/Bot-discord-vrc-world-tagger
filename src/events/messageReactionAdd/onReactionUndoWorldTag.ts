import { EmbedBuilder, Message, MessageReaction, User } from 'discord.js';
import { emojiMap } from '../../assets/media';
import logger from '../../utils/logger';
import { buildWorldUrl } from '../../utils/helpers';
import { extractWorldId } from '../../utils/regex';
import { has, remove } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import { api } from '../../utils/apiClient';
import { getEmojiKey } from '../../utils/discord/reactionEmoji';
import { deleteWorldForGuild } from '../../utils/worldActions';

/** Discord-style red for destructive / removal feedback */
const UNDO_CONFIRM_EMBED_COLOR = 0xed4245;

function reactionIsUndo(reaction: MessageReaction): boolean {
  return getEmojiKey(reaction) === emojiMap.undo;
}

function getWorldIdFromBotWorldMessage(message: Message): string | null {
  const embed = message.embeds[0];
  if (embed?.url) {
    const fromUrl = extractWorldId(embed.url);
    if (fromUrl) return fromUrl;
  }
  if (message.content) {
    return extractWorldId(message.content);
  }
  return null;
}

export const onReactionUndoWorldTag = async (
  reaction: MessageReaction,
  user: User
): Promise<void> => {
  if (user.bot) return;

  if (!reactionIsUndo(reaction)) return;

  try {
    if (reaction.message.partial) {
      await reaction.message.fetch();
    }
  } catch (error) {
    logger.error('Failed to fetch partial message for undo world tag:', error);
    return;
  }

  const message = reaction.message as Message;
  const channelId = message.channelId;

  const isWatchedForReacts = await has(
    kvKeys.WATCHED_REACTION_CHANNELS,
    channelId
  );
  if (!isWatchedForReacts) return;

  if (message.author?.id !== reaction.client.user?.id) return;

  const guildId = message.guildId;
  if (!guildId) return;

  const worldId = getWorldIdFromBotWorldMessage(message);
  if (!worldId) {
    logger.debug(
      `Undo reaction on bot message ${message.id}: no world id in embed/content, skipping`
    );
    return;
  }

  let worldRecord = null;
  try {
    worldRecord = await api.getWorld(worldId);
  } catch (error) {
    logger.warn(
      `Could not fetch world ${worldId} for undo confirmation embed:`,
      error
    );
  }

  // Delete the world record via the API (shared flow used by both
  // reaction shortcut and text-based `.remove`).
  await deleteWorldForGuild(worldId, guildId);

  // Remove the forwarded-message tracking entry (still stored in keyv-file
  // because it tracks bot-forwarded message IDs, not world metadata).
  await remove(kvKeys.REACTION_FORWARDED_MESSAGE_IDS, message.id);

  // Delete the bot's own reply embed
  try {
    await message.delete();
  } catch (error) {
    logger.error(
      `Failed to delete bot message ${message.id} after undo world tag:`,
      error
    );
  }

  // Send a stylish confirmation embed in the same channel
  if (message.channel.isSendable()) {
    const embed = new EmbedBuilder()
      .setColor(UNDO_CONFIRM_EMBED_COLOR)
      .setTitle(
        worldRecord
          ? `${worldRecord.name} by ${worldRecord.authorName}`
          : 'World removed from bot database'
      )
      .setURL(buildWorldUrl(worldId))
      .setDescription(
        'This world was removed from the bot database. The world info message was deleted.'
      )
      .setTimestamp();
    if (worldRecord?.imageUrl) {
      embed.setThumbnail(worldRecord.imageUrl);
    }
    try {
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send undo confirmation embed:', error);
    }
  }
};
