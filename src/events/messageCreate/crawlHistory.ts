import { Message, TextChannel } from 'discord.js';
import logger from '../../utils/logger';
import { getAll } from '../../utils/jsonAsDb/handlers/persistentList';
import { set, get as getValue } from '../../utils/jsonAsDb/index';
import {
  kvKeys,
  CrawlStatus,
  HistoricalWorld
} from '../../utils/jsonAsDb/types';
import { extractWorldIdFromMessage } from './watchForVRCWorldLinks/worldExtraction';
import { emojiMap } from '../../assets/icons';

// Global state to prevent concurrent crawls on the same channel
const activeCrawls = new Map<string, boolean>();

// Rate limiting: Discord allows 5 requests per 5 seconds
const RATE_LIMIT_DELAY = 500; // milliseconds (slightly over 1 second to be safe)
const BATCH_SIZE = 100; // Discord.js default limit

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Start crawling channel history for VRChat world links
 */
export const crawlChannelHistory = async (message: Message) => {
  const channel = message.mentions.channels.first();

  if (!channel) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        '❌ Please mention a channel to crawl (e.g., `.crawlHistory #channel-name`)'
      );
    }
    return;
  }

  if (!(channel instanceof TextChannel)) {
    if (message.channel.isSendable()) {
      await message.channel.send('❌ Can only crawl text channels');
    }
    return;
  }

  // Check if channel is already being crawled
  if (activeCrawls.get(channel.id)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `⏳ Channel ${channel} is already being crawled. Please wait for it to complete.`
      );
    }
    return;
  }

  // Check if channel is being watched
  const watchedChannels = await getAll(kvKeys.WATCHED_CHANNELS);
  if (!watchedChannels.includes(channel.id)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `❌ Channel ${channel} is not being watched. Use \`.watch ${channel}\` first.`
      );
    }
    return;
  }

  // Start the crawl
  activeCrawls.set(channel.id, true);

  try {
    await startCrawl(message, channel);
  } finally {
    activeCrawls.delete(channel.id);
  }
};

/**
 * Start the actual crawling process
 */
const startCrawl = async (message: Message, channel: TextChannel) => {
  // Initialize crawl status
  const crawlStatus: CrawlStatus = {
    channelId: channel.id,
    isRunning: true,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString(),
    messagesProcessed: 0,
    worldsDiscovered: 0,
    lastMessageId: undefined
  };

  // Store crawl status with channel ID as part of the data
  await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
    [channel.id]: crawlStatus
  });

  // Send initial message
  let progressMessage: Message | null = null;
  if (message.channel.isSendable()) {
    progressMessage = await message.channel.send(
      `🔄 **Starting Channel History Crawl**\n\n` +
        `**📺 Channel:** ${channel}\n` +
        `**📊 Status:** Initializing...\n` +
        `**⏱️ Started:** ${new Date().toLocaleString()}\n\n` +
        `This will scan the entire channel history for VRChat world links.\n` +
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
      time: 24 * 60 * 60 * 1000 // 24 hours
    });

    reactionCollector.on('collect', async () => {
      cancellationState.isCancelled = true;
      if (progressMessage && progressMessage.channel.isSendable()) {
        await progressMessage.edit(
          `❌ **Channel History Crawl Cancelled**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${crawlStatus.messagesProcessed}\n` +
            `**🌍 Unique Worlds Discovered:** ${crawlStatus.worldsDiscovered}\n\n` +
            `Crawl was cancelled by ${message.author.toString()}.`
        );
      }
      logger.info(
        `Channel history crawl cancelled by ${message.author.tag} for ${channel.id}`
      );
    });
  }

  try {
    // Start crawling
    await crawlMessages(
      channel,
      crawlStatus,
      progressMessage,
      cancellationState
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

    // Send completion message
    if (message.channel.isSendable()) {
      await message.channel.send({
        content:
          `✅ **Channel History Crawl Complete!**\n\n` +
          `**📺 Channel:** ${channel}\n` +
          `**📊 Messages Processed:** ${crawlStatus.messagesProcessed}\n` +
          `**🌍 Unique Worlds Discovered:** ${crawlStatus.worldsDiscovered}\n\n` +
          `Use \`.export ${channel}\` or \`.exportFull ${channel}\` to export the discovered worlds.`,
        files: []
      });
    }

    logger.info(
      `Channel history crawl completed for ${channel.id}: ${crawlStatus.messagesProcessed} messages, ${crawlStatus.worldsDiscovered} worlds`
    );
  } catch (error) {
    logger.error(`Channel history crawl failed for ${channel.id}:`, error);

    // Update status with error
    crawlStatus.isRunning = false;
    crawlStatus.error = error.message;
    crawlStatus.lastUpdateTime = new Date().toISOString();
    await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
      [channel.id]: crawlStatus
    });

    if (message.channel.isSendable()) {
      await message.channel.send(
        `❌ **Channel History Crawl Failed**\n\n` +
          `**📺 Channel:** ${channel}\n` +
          `**❌ Error:** ${error.message}\n\n` +
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
  channel: TextChannel,
  crawlStatus: CrawlStatus,
  progressMessage: Message | null,
  cancellationState: { isCancelled: boolean }
): Promise<void> => {
  let lastMessageId: string | undefined;
  let totalMessages = 0;
  // Track unique worlds discovered across all batches
  const discoveredWorlds = new Set<string>();

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

      // Log batch processing start
      logger.info(
        `Processing batch of ${messages.size} messages (total processed: ${totalMessages})`
      );

      // Process messages in this batch sequentially
      const messageArray = Array.isArray(messages)
        ? messages
        : messages instanceof Map || (messages as any).values
          ? Array.from((messages as any).values())
          : [messages];

      logger.info(
        `Converted batch to array of ${messageArray.length} messages for sequential processing`
      );

      for (const msg of messageArray) {
        if (cancellationState.isCancelled) break;

        totalMessages++;
        crawlStatus.messagesProcessed = totalMessages;

        // Log message being processed
        logger.info(
          `Crawling message ${totalMessages}: ${msg.id} from ${msg.author?.tag || 'Unknown'} at ${msg.createdAt.toISOString()}`
        );

        // Extract world ID from message sequentially
        const worldId = await extractWorldIdFromMessage(msg.content);
        if (worldId) {
          // Log world discovery
          const isNewWorld = !discoveredWorlds.has(worldId);
          logger.info(
            `World found in message ${msg.id}: ${worldId} ${isNewWorld ? '(NEW)' : '(DUPLICATE)'}`
          );

          // Only count if this world hasn't been discovered yet
          if (isNewWorld) {
            discoveredWorlds.add(worldId);
            crawlStatus.worldsDiscovered = discoveredWorlds.size;
          }

          // Store historical world data
          await storeHistoricalWorld(worldId, channel.id, msg);

          // Add delay only when a world is successfully extracted to prevent rate limiting
          await delay(RATE_LIMIT_DELAY);
        } else {
          // Log when no world is found
          logger.debug(
            `No world found in message ${msg.id}: "${msg.content.substring(0, 100)}..."`
          );
        }

        // Update progress message every 25 messages (batch size) for more frequent updates
        if (
          totalMessages % 25 === 0 &&
          progressMessage &&
          progressMessage.channel.isSendable()
        ) {
          await progressMessage.edit(
            `🔄 **Channel History Crawl in Progress**\n\n` +
              `**📺 Channel:** ${channel}\n` +
              `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
              `**🌍 Unique Worlds Discovered:** ${discoveredWorlds.size.toLocaleString()}\n` +
              `**⏱️ Started:** ${new Date(crawlStatus.startTime).toLocaleString()}\n\n` +
              `**React with ${emojiMap.crossError} to cancel the crawl.**`
          );
        }
      }

      // Log batch completion
      logger.info(
        `Completed batch processing. Total messages: ${totalMessages}, Unique worlds: ${discoveredWorlds.size}`
      );

      // Update last message ID for next batch
      let lastMessage: Message | undefined;
      if (messages instanceof Map || (messages as any).last) {
        // Use last() method if available
        lastMessage = (messages as any).last();
      } else if (Array.isArray(messages)) {
        // Use array indexing
        lastMessage = messages[messages.length - 1];
      } else {
        // Single message case
        lastMessage = messages as Message;
      }

      if (lastMessage) {
        lastMessageId = lastMessage.id;
        crawlStatus.lastMessageId = lastMessageId;
      }

      // Update progress message after each batch completion
      if (progressMessage && progressMessage.channel.isSendable()) {
        await progressMessage.edit(
          `🔄 **Channel History Crawl in Progress**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
            `**🌍 Unique Worlds Discovered:** ${discoveredWorlds.size.toLocaleString()}\n` +
            `**⏱️ Started:** ${new Date(crawlStatus.startTime).toLocaleString()}\n\n` +
            `**React with ${emojiMap.crossError} to cancel the crawl.**`
        );
      }

      // Update crawl status
      crawlStatus.lastUpdateTime = new Date().toISOString();
      await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
        [channel.id]: crawlStatus
      });

      // Rate limiting
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error(`Error fetching messages for ${channel.id}:`, error);
      throw error;
    }
  }
};

/**
 * Store historical world data
 */
const storeHistoricalWorld = async (
  worldId: string,
  channelId: string,
  message: Message
) => {
  try {
    // Get existing historical world or create new one
    const existingWorld = await getValue(kvKeys.HISTORICAL_WORLDS);
    const worldData = (existingWorld as Record<string, HistoricalWorld>) || {};

    const now = new Date().toISOString();
    const source = {
      channelId,
      messageId: message.id,
      timestamp: message.createdAt.toISOString(),
      content: message.content.substring(0, 500) // Limit content length
    };

    if (worldData[worldId]) {
      // Update existing world
      const world: HistoricalWorld = {
        ...worldData[worldId],
        lastSeen: now,
        messageCount: worldData[worldId].messageCount + 1,
        channels: worldData[worldId].channels.includes(channelId)
          ? worldData[worldId].channels
          : [...worldData[worldId].channels, channelId],
        sources: [...worldData[worldId].sources, source]
      };
      worldData[worldId] = world;
    } else {
      // Create new historical world
      const world: HistoricalWorld = {
        worldId,
        firstSeen: now,
        lastSeen: now,
        messageCount: 1,
        channels: [channelId],
        sources: [source]
      };
      worldData[worldId] = world;
    }

    await set(kvKeys.HISTORICAL_WORLDS, worldData);

    // Also add to duplicate handler database to prevent future duplicate alerts
    // Use the first source message as the "original" message for duplicate detection
    if (message.guildId) {
      const duplicateKey = `${worldId}-${message.guildId}`;
      const existingDuplicateEntry = await getValue(
        kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID
      );

      if (
        existingDuplicateEntry &&
        typeof existingDuplicateEntry === 'object'
      ) {
        const duplicateData = existingDuplicateEntry as Record<string, string>;
        if (!duplicateData[duplicateKey]) {
          // Only add if not already present
          duplicateData[duplicateKey] = message.id;
          await set(
            kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
            duplicateData
          );
          logger.info(
            `Added crawled world ${worldId} to duplicate handler database with message ID ${message.id}`
          );
        }
      } else {
        // Create new duplicate handler entry
        const duplicateData = { [duplicateKey]: message.id };
        await set(
          kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
          duplicateData
        );
        logger.info(
          `Created duplicate handler entry for crawled world ${worldId} with message ID ${message.id}`
        );
      }
    }
  } catch (error) {
    logger.error(`Error storing historical world ${worldId}:`, error);
  }
};

/**
 * Check crawl status for a channel
 */
export const getCrawlStatus = async (message: Message) => {
  const channel = message.mentions.channels.first();

  if (!channel) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        '❌ Please mention a channel to check status (e.g., `.crawlStatus #channel-name`)'
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
        `**🌍 Unique Worlds Discovered:** ${status.worldsDiscovered.toLocaleString()}\n` +
        `**⏱️ Started:** ${new Date(status.startTime).toLocaleString()}\n` +
        `**🕐 Last Update:** ${new Date(status.lastUpdateTime).toLocaleString()}` +
        (status.error ? `\n**❌ Error:** ${status.error}` : '')
    );
  }
};
