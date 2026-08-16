import { Client, GuildTextBasedChannel } from 'discord.js';
import logger from './logger';
import { get } from './jsonAsDb';
import { getFirst } from './jsonAsDb/handlers/persistentList';
import { kvKeys } from './jsonAsDb/types';
import {
  HighPriorityForward,
  recordHighPriorityForward,
  takeHighPriorityForward
} from './highPriorityChannel';
import { api, isApiError } from './apiClient';
import { extractWorldIdFromAnywhere } from '../events/messageCreate/crawlHistory';

export const BATCH_SIZE = 100;
export const RATE_LIMIT_DELAY = 250;
export const MAX_MESSAGES = 5000;

export interface HighPriorityCrawlResult {
  ok: boolean;
  reason?: 'not-configured' | 'not-found' | 'error';
  scanned: number;
  added: number;
  removed: number;
  truncated: boolean;
  error?: unknown;
}

let activeCrawl = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function crawlHighPriorityChannel(
  client: Client
): Promise<HighPriorityCrawlResult> {
  const fail = (
    reason: 'not-configured' | 'not-found' | 'error'
  ): HighPriorityCrawlResult => ({
    ok: false,
    reason,
    scanned: 0,
    added: 0,
    removed: 0,
    truncated: false
  });

  const channelId = await getFirst(kvKeys.HIGH_PRIORITY_FORWARDING_CHANNEL);
  if (!channelId) return fail('not-configured');

  const fetched = await client.channels.fetch(channelId);
  if (!fetched || !fetched.isTextBased()) return fail('not-found');
  const channel = fetched as GuildTextBasedChannel;
  if (!channel.guildId) return fail('not-found');

  if (activeCrawl) {
    logger.warn('High priority channel crawl already in progress, skipping');
    return fail('error');
  }
  activeCrawl = true;

  try {
    const found = new Map<string, HighPriorityForward>();
    let scanned = 0;
    let lastMessageId: string | undefined;

    while (scanned < MAX_MESSAGES) {
      const options: { limit: number; before?: string } = {
        limit: BATCH_SIZE
      };
      if (lastMessageId) options.before = lastMessageId;

      const messages = await channel.messages.fetch(options);
      if (!messages || messages.size === 0) break;

      const batch = Array.from(messages.values());
      scanned += batch.length;

      for (const msg of batch) {
        const worldId = await extractWorldIdFromAnywhere(msg);
        if (worldId) {
          found.set(msg.id, {
            worldId,
            guildId: msg.guildId ?? channel.guildId
          });
        }
      }

      if (batch.length < BATCH_SIZE) break;
      lastMessageId = batch[batch.length - 1].id;
      await delay(RATE_LIMIT_DELAY);
    }

    const truncated = scanned >= MAX_MESSAGES;

    const recorded = new Map<string, HighPriorityForward>();
    const rawRecorded = await get<Record<string, string>>(
      kvKeys.HIGH_PRIORITY_FORWARDED_MESSAGES
    );
    if (rawRecorded) {
      for (const [messageId, raw] of Object.entries(rawRecorded)) {
        try {
          const parsed = JSON.parse(raw) as HighPriorityForward | null;
          if (parsed?.worldId && parsed?.guildId) {
            recorded.set(messageId, parsed);
          }
        } catch {
          logger.warn(
            `Skipping unparseable high priority forward record for message ${messageId}`
          );
        }
      }
    }

    let added = 0;
    for (const [messageId, { worldId, guildId }] of found) {
      if (recorded.has(messageId)) continue;
      try {
        await api.setHighPriority(worldId, guildId);
        await recordHighPriorityForward(messageId, { worldId, guildId });
        added++;
      } catch (error) {
        logger.error(
          `Failed to mark world ${worldId} high priority from message ${messageId}:`,
          error
        );
      }
    }

    let removed = 0;
    if (!truncated) {
      for (const [messageId, { worldId, guildId }] of recorded) {
        if (found.has(messageId)) continue;
        try {
          await api.removeHighPriority(worldId, guildId);
          await takeHighPriorityForward(messageId);
          removed++;
        } catch (error) {
          if (isApiError(error) && error.status === 404) {
            logger.warn(
              `World ${worldId} not found in guild ${guildId} (high priority remove noop)`
            );
            await takeHighPriorityForward(messageId);
            removed++;
          } else {
            logger.error(
              `Failed to remove high priority for world ${worldId} in guild ${guildId}:`,
              error
            );
          }
        }
      }
    }

    return { ok: true, scanned, added, removed, truncated };
  } finally {
    activeCrawl = false;
  }
}
