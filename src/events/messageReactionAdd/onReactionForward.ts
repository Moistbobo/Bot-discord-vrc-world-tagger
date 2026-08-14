import { messageLink, MessageReaction, User } from 'discord.js';
import logger from '../../utils/logger';
import { get } from '../../utils/jsonAsDb';
import {
  has,
  add,
  getFirst
} from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import { api } from '../../utils/apiClient';
import { extractWorldId } from '../../utils/regex';
import {
  getEmojiKey,
  resolveForwardTargetChannelId,
  type ReactionForwardConfig
} from '../../utils/discord/reactionEmoji';

function getWorldIdFromMessageContentOrEmbed(
  reaction: MessageReaction
): string | null {
  const msg = reaction.message;
  if (msg.embeds?.[0]?.url) {
    const fromUrl = extractWorldId(msg.embeds[0].url);
    if (fromUrl) return fromUrl;
  }
  if (msg.content) {
    return extractWorldId(msg.content);
  }
  return null;
}

async function resolveQualityForChannel(
  targetChannelId: string
): Promise<'good' | 'bad' | null> {
  const goodChannel = await getFirst(kvKeys.QUALITY_GOOD_FORWARDING_CHANNEL);
  if (goodChannel === targetChannelId) return 'good';

  const badChannel = await getFirst(kvKeys.QUALITY_BAD_FORWARDING_CHANNEL);
  if (badChannel === targetChannelId) return 'bad';

  return null;
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
        `Failed to forward message ${message.id} to channel ${targetChannelId}:\n`,
        error
      );
      return;
    }
  }

  // ── Quality tracking ──────────────────────────────────────────────
  // If the target channel is configured as a "good" or "bad" quality
  // channel, mark the world record accordingly.
  const guildId = message.guildId;
  const worldId = guildId
    ? getWorldIdFromMessageContentOrEmbed(reaction)
    : null;
  if (worldId && guildId) {
    const quality = await resolveQualityForChannel(targetChannelId);
    if (quality) {
      try {
        await api.setQuality(worldId, guildId, quality);
      } catch (err) {
        logger.error(
          `Failed to set quality for forwarded world ${worldId}:`,
          err
        );
      }
    }
  }

  // ── Record forward so we don't forward the same message twice ────
  const addResult = await add(
    kvKeys.REACTION_FORWARDED_MESSAGE_IDS,
    message.id
  );
  if (!addResult.success) {
    logger.error(
      `Failed to record forwarded message id ${message.id}:\n`,
      addResult.error
    );
  }
};
