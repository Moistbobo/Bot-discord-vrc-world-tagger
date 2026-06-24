import { Message, GuildTextBasedChannel } from 'discord.js';
import logger from '../../utils/logger';
import { shouldIgnoreOwnBotMessage } from '../../botFilters';
import { isUserOnIgnoreList } from '../../utils/ignoreList';
import { getAll } from '../../utils/jsonAsDb/handlers/persistentList';
import { set, get as getValue } from '../../utils/jsonAsDb/index';
import { kvKeys, CrawlStatus } from '../../utils/jsonAsDb/types';
import {
  extractAllWorldIdsFromMessage,
  extractWorldIdFromMessage
} from './watchForVRCWorldLinks/worldExtraction';
import { buildTagSource, processWorldId } from './watchForVRCWorldLinks';
import { extractWorldId } from '../../utils/regex';
import { emojiMap } from '../../assets/media';
import { getWorldRepository } from '../../utils/database/worldRepository';
import { extractTags } from '../../utils/tagExtractor';

// Global state to prevent concurrent crawls on the same channel
const activeCrawls = new Map<string, boolean>();

const RATE_LIMIT_DELAY = 250;
const BATCH_SIZE = 100;

type CrawlMode = 'discover' | 'tags' | 'quality';

interface ParsedCrawlCommand {
  channel: GuildTextBasedChannel;
  mode: CrawlMode;
  qualityValue?: 'good' | 'bad';
}

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Convert a Discord message's created timestamp to Unix seconds.
 * This is the value stored in internal_add_date.
 */
const getMessageInternalAddDate = (msg: Message): number => {
  return typeof msg.createdTimestamp === 'number'
    ? Math.floor(msg.createdTimestamp / 1000)
    : Math.floor(Date.now() / 1000);
};

/**
 * Parse .crawlHistory command into mode and options.
 * Syntax: .crawlHistory #channel [--tags | --quality good|bad]
 */
function parseCrawlCommand(message: Message): ParsedCrawlCommand | null {
  const mentioned = message.mentions.channels.first();

  if (!mentioned || !mentioned.isTextBased()) {
    return null;
  }

  const channel = mentioned as GuildTextBasedChannel;

  const content = message.content;
  let mode: CrawlMode = 'discover';
  let qualityValue: 'good' | 'bad' | undefined;

  if (content.includes('--tags')) {
    mode = 'tags';
  } else if (content.includes('--quality')) {
    mode = 'quality';
    const match = content.match(/--quality\s+(good|bad)/i);
    if (match) {
      qualityValue = match[1].toLowerCase() as 'good' | 'bad';
    }
    if (!qualityValue) {
      return null; // invalid quality argument
    }
  }

  return { channel, mode, qualityValue };
}

/**
 * Extract the first world ID from a message, checking raw content,
 * embed URLs/descriptions, and Discord native message snapshots (forwards).
 */
function extractWorldIdFromAnywhere(msg: Message): string | null {
  // 1. Try raw message content
  const fromContent = extractWorldId(msg.content);
  if (fromContent) return fromContent;

  // 2. Try embed URLs and descriptions
  for (const embed of msg.embeds) {
    const fromUrl = embed.url ? extractWorldId(embed.url) : null;
    if (fromUrl) return fromUrl;

    const fromDesc = embed.description
      ? extractWorldId(embed.description)
      : null;
    if (fromDesc) return fromDesc;
  }

  // 3. Try Discord native message snapshots (forwarded messages)
  if (msg.messageSnapshots) {
    for (const snapshot of msg.messageSnapshots.values()) {
      const fromSnapContent = snapshot.content
        ? extractWorldId(snapshot.content)
        : null;
      if (fromSnapContent) return fromSnapContent;

      for (const embed of snapshot.embeds || []) {
        const fromSnapUrl = embed.url ? extractWorldId(embed.url) : null;
        if (fromSnapUrl) return fromSnapUrl;

        const fromSnapDesc = embed.description
          ? extractWorldId(embed.description)
          : null;
        if (fromSnapDesc) return fromSnapDesc;
      }
    }
  }

  return null;
}

/**
 * Start crawling channel history for VRChat world links
 */
export const crawlChannelHistory = async (message: Message) => {
  const parsed = parseCrawlCommand(message);

  if (!parsed) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `${emojiMap.crossError} Please mention a text channel to crawl.\n` +
          `**Usage:**\n` +
          `\`.crawlHistory #channel\` — discover new worlds (default)\n` +
          `\`.crawlHistory #channel --tags\` — rebuild tags & source_content\n` +
          `\`.crawlHistory #channel --quality good|bad\` — assign quality`
      );
    }
    return;
  }

  const { channel, mode, qualityValue } = parsed;

  // Check if channel is already being crawled
  if (activeCrawls.get(channel.id)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `⏳ Channel ${channel} is already being crawled. Please wait for it to complete.`
      );
    }
    return;
  }

  // Only enforce watched-channel restriction for discover mode
  if (mode === 'discover') {
    const watchedChannels = await getAll(kvKeys.WATCHED_CHANNELS);
    if (!watchedChannels.includes(channel.id)) {
      if (message.channel.isSendable()) {
        await message.channel.send(
          `${emojiMap.crossError} Channel ${channel} is not being watched. Use \`.watch ${channel}\` first.`
        );
      }
      return;
    }
  }

  // Start the crawl
  activeCrawls.set(channel.id, true);

  try {
    await startCrawl(message, channel, mode, qualityValue);
  } finally {
    activeCrawls.delete(channel.id);
  }
};

/**
 * Start the actual crawling process
 */
const startCrawl = async (
  message: Message,
  channel: GuildTextBasedChannel,
  mode: CrawlMode,
  qualityValue?: 'good' | 'bad'
) => {
  // Start timing the crawl operation
  const crawlStartTime = Date.now();

  // Check for existing crawl status to potentially resume
  const existingStatuses = await getValue(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS);
  const existingStatus =
    existingStatuses &&
    typeof existingStatuses === 'object' &&
    existingStatuses[channel.id]
      ? (existingStatuses[channel.id] as CrawlStatus)
      : null;

  let isResuming = false;
  let crawlStatus: CrawlStatus;

  if (existingStatus && existingStatus.isRunning) {
    // Resume from existing interrupted crawl
    isResuming = true;
    crawlStatus = {
      ...existingStatus,
      isRunning: true,
      lastUpdateTime: new Date().toISOString()
    };

    logger.info(
      `Resuming interrupted crawl for channel ${channel.id} from message ${crawlStatus.lastMessageId || 'beginning'}`
    );
  } else {
    // Start new crawl
    crawlStatus = {
      channelId: channel.id,
      isRunning: true,
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
      messagesProcessed: 0,
      worldsDiscovered: 0,
      lastMessageId: undefined
    };
  }

  // Store crawl status with channel ID as part of the data
  await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
    [channel.id]: crawlStatus
  });

  // Mode-specific counters (local, not persisted in CrawlStatus)
  let recordsUpdated = 0;
  let recordsNotFound = 0;

  // Send initial message
  let progressMessage: Message | null = null;
  if (message.channel.isSendable()) {
    const modeLabel =
      mode === 'discover'
        ? '🔍 Discover'
        : mode === 'tags'
          ? '🏷️ Rebuild Tags'
          : `⭐ Quality (${qualityValue})`;

    const statusText = isResuming ? 'Resuming...' : 'Initializing...';
    const descriptionText = isResuming
      ? `Resuming crawl from message ${crawlStatus.lastMessageId || 'beginning'}`
      : mode === 'discover'
        ? 'Scanning channel history for VRChat world links.'
        : mode === 'tags'
          ? 'Rebuilding tags and source_content from message history.'
          : `Assigning "${qualityValue}" quality to worlds in this channel.`;

    progressMessage = await message.channel.send(
      `🔄 **${isResuming ? 'Resuming' : 'Starting'} ${modeLabel} Crawl**\n\n` +
        `**📺 Channel:** ${channel}\n` +
        `**📊 Status:** ${statusText}\n` +
        `**⏱️ Started:** <t:${Math.floor(new Date(crawlStatus.startTime).getTime() / 1000)}:F>\n` +
        (isResuming
          ? `**📊 Progress:** ${crawlStatus.messagesProcessed.toLocaleString()} messages, ${crawlStatus.worldsDiscovered.toLocaleString()} worlds\n`
          : '') +
        `\n${descriptionText}\n` +
        `**React with ${emojiMap.crossError} to cancel the crawl.**`
    );

    // Add cancellation reaction
    await progressMessage.react(emojiMap.crossError);
  }

  // Set up cancellation using shared object
  const cancellationState = { isCancelled: false };
  let reactionCollector: any = null;

  if (progressMessage) {
    reactionCollector = progressMessage.createReactionCollector({
      filter: (reaction, user) =>
        reaction.emoji.name === emojiMap.crossError &&
        user.id === message.author.id,
      time: 48 * 60 * 60 * 1000 // 48 hours
    });

    reactionCollector.on('collect', async () => {
      cancellationState.isCancelled = true;
      if (progressMessage && progressMessage.channel.isSendable()) {
        const cancelDuration = Date.now() - crawlStartTime;
        const cancelMinutes = Math.floor(cancelDuration / 60000);
        const cancelSeconds = Math.floor((cancelDuration % 60000) / 1000);
        const cancelDurationText =
          cancelMinutes > 0
            ? `${cancelMinutes}m ${cancelSeconds}s`
            : `${cancelSeconds}s`;

        await progressMessage.edit(
          `${emojiMap.crossError} **${mode === 'discover' ? 'Channel History Crawl' : mode === 'tags' ? 'Tag Rebuild' : 'Quality Assignment'} Cancelled**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${crawlStatus.messagesProcessed}\n` +
            (mode === 'discover'
              ? `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered}\n`
              : `**✅ Records Updated:** ${recordsUpdated}\n`) +
            `**⏱️ Duration:** ${cancelDurationText}\n\n` +
            `Crawl was cancelled by ${message.author.toString()}.\n\n` +
            `**💡 Tip:** Run the command again to resume from where you left off.`
        );
      }
      logger.info(`Crawl cancelled by ${message.author.tag} for ${channel.id}`);
    });
  }

  try {
    // Start crawling
    await crawlMessages(
      channel,
      crawlStatus,
      progressMessage,
      cancellationState,
      mode,
      qualityValue,
      (updated, notFound) => {
        recordsUpdated = updated;
        recordsNotFound = notFound;
      }
    );

    if (cancellationState.isCancelled) {
      return;
    }

    // Update final status
    crawlStatus.isRunning = false;
    crawlStatus.lastUpdateTime = new Date().toISOString();
    await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
      [channel.id]: crawlStatus
    });

    // Calculate total crawl duration
    const crawlDuration = Date.now() - crawlStartTime;
    const durationMinutes = Math.floor(crawlDuration / 60000);
    const durationSeconds = Math.floor((crawlDuration % 60000) / 1000);
    const durationText =
      durationMinutes > 0
        ? `${durationMinutes}m ${durationSeconds}s`
        : `${durationSeconds}s`;

    // Send completion message
    if (message.channel.isSendable()) {
      const modeLabel =
        mode === 'discover'
          ? 'Channel History Crawl'
          : mode === 'tags'
            ? 'Tag Rebuild'
            : 'Quality Assignment';

      const statsLine =
        mode === 'discover'
          ? `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered}`
          : `**✅ Records Updated:** ${recordsUpdated}\n**⚠️ Not Found:** ${recordsNotFound}`;

      await message.channel.send({
        content:
          `✅ **${modeLabel} Complete!**\n\n` +
          `**📺 Channel:** ${channel}\n` +
          `**📊 Messages Processed:** ${crawlStatus.messagesProcessed}\n` +
          statsLine +
          `\n**⏱️ Duration:** ${durationText}\n\n`,
        files: []
      });
    }

    logger.info(
      `Crawl completed for ${channel.id}: ${crawlStatus.messagesProcessed} messages in ${durationText}`
    );
  } catch (error) {
    logger.error(`Crawl failed for ${channel.id}:`, error);

    // Update status with error
    crawlStatus.isRunning = false;
    crawlStatus.error = error.message;
    crawlStatus.lastUpdateTime = new Date().toISOString();
    await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
      [channel.id]: crawlStatus
    });

    if (message.channel.isSendable()) {
      const modeLabel =
        mode === 'discover'
          ? 'Channel History Crawl'
          : mode === 'tags'
            ? 'Tag Rebuild'
            : 'Quality Assignment';
      await message.channel.send(
        `${emojiMap.crossError} **${modeLabel} Failed**\n\n` +
          `**📺 Channel:** ${channel}\n` +
          `**${emojiMap.crossError} Error:** ${error.message}\n\n` +
          `Please try again later or contact an administrator.`
      );
    }
  } finally {
    if (reactionCollector) {
      reactionCollector.stop();
    }
  }
};

/**
 * Crawl messages in batches
 */
const crawlMessages = async (
  channel: GuildTextBasedChannel,
  crawlStatus: CrawlStatus,
  progressMessage: Message | null,
  cancellationState: { isCancelled: boolean },
  mode: CrawlMode,
  qualityValue: 'good' | 'bad' | undefined,
  onProgress: (updated: number, notFound: number) => void
): Promise<void> => {
  let lastMessageId: string | undefined = crawlStatus.lastMessageId;
  let totalMessages = crawlStatus.messagesProcessed;
  let recordsUpdated = 0;
  let recordsNotFound = 0;

  const repo = getWorldRepository();

  // Load all processed worlds into memory for fast cache lookups
  logger.info('Loading processed worlds cache from SQLite...');
  const processedWorldsCache = repo.getAllWorldGuildPairs();
  logger.info(
    `Loaded ${processedWorldsCache.size} processed worlds into cache`
  );

  // If resuming, we need to get the existing discovered worlds count
  if (crawlStatus.worldsDiscovered > 0) {
    logger.info(
      `Resuming crawl with ${crawlStatus.worldsDiscovered} previously discovered worlds`
    );
  }

  while (!cancellationState.isCancelled) {
    try {
      // Fetch batch of messages
      const options: any = { limit: BATCH_SIZE };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const messages = await channel.messages.fetch(options);

      // Ensure we have a Collection of messages
      if (
        !messages ||
        typeof messages !== 'object' ||
        !('size' in messages) ||
        messages.size === 0
      ) {
        logger.info(
          `No more messages to fetch. Crawl complete with ${totalMessages} messages processed.`
        );
        break; // No more messages
      }

      // Process messages in this batch sequentially
      const messageArray = Array.isArray(messages)
        ? messages
        : messages instanceof Map || (messages as any).values
          ? Array.from((messages as any).values())
          : [messages];

      for (const msg of messageArray) {
        if (cancellationState.isCancelled) break;

        totalMessages++;
        crawlStatus.messagesProcessed = totalMessages;

        logger.info(
          `Crawling message ${totalMessages}: ${msg.id} at ${msg.createdAt.toISOString()}`
        );

        // Skip bot's own messages and ignored users
        if (shouldIgnoreOwnBotMessage(msg.author.id, msg.client.user?.id)) {
          logger.debug(`Skipping message ${msg.id}: bot's own message`);
          continue;
        }
        if (await isUserOnIgnoreList(msg.author.id)) {
          logger.debug(`Skipping message ${msg.id}: author is on ignore list`);
          continue;
        }

        // ── DISCOVER MODE ──
        if (mode === 'discover') {
          await handleDiscoverMode(
            msg,
            processedWorldsCache,
            crawlStatus,
            repo
          );
        }

        // ── TAGS MODE ──
        else if (mode === 'tags') {
          const result = await handleTagsMode(msg, processedWorldsCache, repo);
          recordsUpdated += result.updated;
          recordsNotFound += result.notFound;
        }

        // ── QUALITY MODE ──
        else if (mode === 'quality' && qualityValue) {
          const result = await handleQualityMode(
            msg,
            processedWorldsCache,
            repo,
            qualityValue
          );
          if (result.updated) recordsUpdated++;
          if (result.notFound) recordsNotFound++;
        }

        // Update progress message every 25 messages
        if (
          totalMessages % 25 === 0 &&
          progressMessage &&
          progressMessage.channel.isSendable() &&
          !cancellationState.isCancelled
        ) {
          const progressText =
            mode === 'discover'
              ? `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered.toLocaleString()}`
              : `**✅ Records Updated:** ${recordsUpdated.toLocaleString()}\n**⚠️ Not Found:** ${recordsNotFound.toLocaleString()}`;

          await progressMessage.edit(
            `🔄 **${mode === 'discover' ? 'Channel History Crawl' : mode === 'tags' ? 'Tag Rebuild' : 'Quality Assignment'} in Progress**\n\n` +
              `**📺 Channel:** ${channel}\n` +
              `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
              progressText +
              `\n**⏱️ Started:** <t:${Math.floor(new Date(crawlStatus.startTime).getTime() / 1000)}:F>\n\n` +
              `**React with ${emojiMap.crossError} to cancel the crawl.**`
          );
        }
      }

      // Log batch completion
      logger.info(
        `Completed batch processing. Total messages: ${totalMessages}`
      );

      // Update last message ID for next batch
      let lastMessage: Message | undefined;
      if (messages instanceof Map || (messages as any).last) {
        lastMessage = (messages as any).last();
      } else if (Array.isArray(messages)) {
        lastMessage = messages[messages.length - 1];
      } else {
        lastMessage = messages as Message;
      }

      if (lastMessage) {
        lastMessageId = lastMessage.id;
        crawlStatus.lastMessageId = lastMessageId;
      }

      // Update progress message after each batch completion
      if (
        progressMessage &&
        progressMessage.channel.isSendable() &&
        !cancellationState.isCancelled
      ) {
        const progressText =
          mode === 'discover'
            ? `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered.toLocaleString()}`
            : `**✅ Records Updated:** ${recordsUpdated.toLocaleString()}\n**⚠️ Not Found:** ${recordsNotFound.toLocaleString()}`;

        await progressMessage.edit(
          `🔄 **${mode === 'discover' ? 'Channel History Crawl' : mode === 'tags' ? 'Tag Rebuild' : 'Quality Assignment'} in Progress**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
            progressText +
            `\n**⏱️ Started:** <t:${Math.floor(new Date(crawlStatus.startTime).getTime() / 1000)}:F>\n\n` +
            `**React with ${emojiMap.crossError} to cancel the crawl.**`
        );
      }

      // Update crawl status
      if (!cancellationState.isCancelled) {
        crawlStatus.lastUpdateTime = new Date().toISOString();
        await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
          [channel.id]: crawlStatus
        });
      }

      onProgress(recordsUpdated, recordsNotFound);
    } catch (error) {
      logger.error(`Error fetching messages for ${channel.id}:`, error);
      throw error;
    }
  }
};

/**
 * Handle a single message in discover mode.
 * New worlds are fetched and inserted silently; existing worlds have their
 * internal_add_date backfilled from the original Discord message timestamp.
 */
async function handleDiscoverMode(
  msg: Message,
  processedWorldsCache: Set<string>,
  crawlStatus: CrawlStatus,
  repo: ReturnType<typeof getWorldRepository>
): Promise<void> {
  const internalAddDate = getMessageInternalAddDate(msg);

  // Quick cache check
  const potentialWorldId = extractWorldId(msg.content);
  if (potentialWorldId) {
    const cacheKey = `${potentialWorldId}-${msg.guildId}`;
    if (processedWorldsCache.has(cacheKey)) {
      repo.backfillInternalAddDate(
        potentialWorldId,
        msg.guildId!,
        internalAddDate
      );
      logger.debug(
        `Skipping message ${msg.id}: world ${potentialWorldId} already processed (cache hit)`
      );
      return;
    }
  }

  const worldId = await extractWorldIdFromMessage(msg.content);
  if (!worldId) {
    logger.debug(
      `No world found in message ${msg.id}: "${msg.content.substring(0, 100)}..."`
    );
    return;
  }

  const cacheKey = `${worldId}-${msg.guildId}`;

  // Existing world: backfill internal_add_date and move on
  if (repo.getByWorldAndGuild(worldId, msg.guildId!)) {
    repo.backfillInternalAddDate(worldId, msg.guildId!, internalAddDate);
    processedWorldsCache.add(cacheKey);
    logger.info(`World found in message ${msg.id}: ${worldId} (DUPLICATE)`);
    await delay(RATE_LIMIT_DELAY);
    return;
  }

  // New world: silently fetch and persist it so it has the correct timestamp
  try {
    await processWorldId(msg, worldId, msg.content, {
      skipDuplicateCheck: true,
      silent: true,
      internalAddDate
    });

    crawlStatus.worldsDiscovered = crawlStatus.worldsDiscovered + 1;
    processedWorldsCache.add(cacheKey);
    logger.info(`World found in message ${msg.id}: ${worldId} (NEW)`);
  } catch (error) {
    logger.warn(
      `Could not persist discovered world ${worldId} from message ${msg.id}:`,
      error
    );
  }

  await delay(RATE_LIMIT_DELAY);
}

/**
 * Handle a single message in tags mode.
 * Returns counts of updated and not-found records.
 */
async function handleTagsMode(
  msg: Message,
  processedWorldsCache: Set<string>,
  repo: ReturnType<typeof getWorldRepository>
): Promise<{ updated: number; notFound: number }> {
  // Extract world ID + source content (resolves Twitter links)
  let allResults = await extractAllWorldIdsFromMessage(msg.content);

  // Fallback: check Discord native message snapshots (forwards)
  if (allResults.length === 0 && msg.messageSnapshots) {
    for (const snapshot of msg.messageSnapshots.values()) {
      if (snapshot.content) {
        allResults = await extractAllWorldIdsFromMessage(snapshot.content);
        if (allResults.length > 0) break;
      }
    }
  }

  if (allResults.length === 0) {
    logger.debug(`No world found in message ${msg.id} for tag rebuild`);
    return { updated: 0, notFound: 0 };
  }

  // Build tag source from all message sources, exactly like normal processing
  const tagSource = buildTagSource(
    msg,
    allResults.map((r) => r.sourceContent)
  );
  const tags = extractTags(tagSource);

  const internalAddDate = getMessageInternalAddDate(msg);
  let updated = 0;
  let notFound = 0;

  for (const { worldId, sourceContent } of allResults) {
    const cacheKey = `${worldId}-${msg.guildId}`;

    if (!processedWorldsCache.has(cacheKey)) {
      logger.warn(
        `Skipping message ${msg.id}: world ${worldId} not in database (tags mode)`
      );
      notFound++;
      continue;
    }

    const didUpdate = repo.updateTags(
      worldId,
      msg.guildId!,
      tags,
      sourceContent
    );

    repo.backfillInternalAddDate(worldId, msg.guildId!, internalAddDate);

    if (didUpdate) {
      logger.info(
        `Rebuilt tags for ${worldId}: [${tags.join(', ')}] from message ${msg.id}`
      );
      updated++;
    }
  }

  await delay(RATE_LIMIT_DELAY);
  return { updated, notFound };
}

/**
 * Handle a single message in quality mode.
 * Returns whether the record was updated and whether it was not found.
 */
async function handleQualityMode(
  msg: Message,
  processedWorldsCache: Set<string>,
  repo: ReturnType<typeof getWorldRepository>,
  qualityValue: 'good' | 'bad'
): Promise<{ updated: boolean; notFound: boolean }> {
  // Extract world ID from anywhere (content or embeds)
  const worldId = extractWorldIdFromAnywhere(msg);

  if (!worldId) {
    logger.debug(`No world found in message ${msg.id} for quality assignment`);
    return { updated: false, notFound: false };
  }

  const cacheKey = `${worldId}-${msg.guildId}`;

  if (!processedWorldsCache.has(cacheKey)) {
    logger.warn(
      `Skipping message ${msg.id}: world ${worldId} not in database (quality mode)`
    );
    return { updated: false, notFound: true };
  }

  const didUpdate = repo.updateQuality(worldId, msg.guildId!, qualityValue);
  const internalAddDate = getMessageInternalAddDate(msg);
  repo.backfillInternalAddDate(worldId, msg.guildId!, internalAddDate);

  if (didUpdate) {
    logger.info(
      `Assigned ${qualityValue} to ${worldId} from message ${msg.id}`
    );
  }

  await delay(RATE_LIMIT_DELAY);
  return { updated: didUpdate, notFound: false };
}

/**
 * Check crawl status for a channel
 */
export const getCrawlStatus = async (message: Message) => {
  const channel = message.mentions.channels.first();

  if (!channel) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `${emojiMap.crossError} Please mention a channel to check status (e.g., \`.crawlStatus #channel-name\`)`
      );
    }
    return;
  }

  const allStatuses = await getValue(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS);
  const status =
    allStatuses && typeof allStatuses === 'object' && allStatuses[channel.id]
      ? (allStatuses[channel.id] as CrawlStatus)
      : null;

  if (!status) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `📭 **No Crawl History**\n\nChannel ${channel} has never been crawled.`
      );
    }
    return;
  }

  const statusMessage = status.isRunning
    ? `🔄 **Crawl in Progress**`
    : `✅ **Crawl Complete**`;

  if (message.channel.isSendable()) {
    await message.channel.send(
      `${statusMessage}\n\n` +
        `**📺 Channel:** ${channel}\n` +
        `**📊 Messages Processed:** ${status.messagesProcessed.toLocaleString()}\n` +
        `**🌍 New Worlds Discovered:** ${status.worldsDiscovered.toLocaleString()}\n` +
        `**⏱️ Started:** <t:${Math.floor(new Date(status.startTime).getTime() / 1000)}:F>\n` +
        `**🕐 Last Update:** <t:${Math.floor(new Date(status.lastUpdateTime).getTime() / 1000)}:F>` +
        (status.error
          ? `\n**${emojiMap.crossError} Error:** ${status.error}`
          : '')
    );
  }
};
