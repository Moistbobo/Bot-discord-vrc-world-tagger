import { Message, TextChannel } from 'discord.js';
import logger from '../../utils/logger';
import { getAll } from '../../utils/jsonAsDb/handlers/persistentList';
import { set, get as getValue } from '../../utils/jsonAsDb/index';
import { getValue as getKvpValue } from '../../utils/jsonAsDb/handlers/persistentKvp';
import { kvKeys, CrawlStatus } from '../../utils/jsonAsDb/types';
import { extractWorldIdFromMessage } from './watchForVRCWorldLinks/worldExtraction';
import { checkAndHandleDuplicate } from './watchForVRCWorldLinks/duplicateHandler';
import { emojiMap } from '../../assets/icons';

// Global state to prevent concurrent crawls on the same channel
const activeCrawls = new Map<string, boolean>();

// Rate limiting: Discord allows 5 requests per 5 seconds
const RATE_LIMIT_DELAY = 500;
const BATCH_SIZE = 100;

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
        `${emojiMap.crossError} Please mention a channel to crawl (e.g., \`.crawlHistory #channel-name\`)`
      );
    }
    return;
  }

  if (!(channel instanceof TextChannel)) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        `${emojiMap.crossError} Can only crawl text channels`
      );
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
        `${emojiMap.crossError} Channel ${channel} is not being watched. Use \`.watch ${channel}\` first.`
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

  // Send initial message
  let progressMessage: Message | null = null;
  if (message.channel.isSendable()) {
    const statusText = isResuming ? 'Resuming...' : 'Initializing...';
    const descriptionText = isResuming
      ? `Resuming crawl from message ${crawlStatus.lastMessageId || 'beginning'}`
      : 'This will scan the entire channel history for VRChat world links.';

    progressMessage = await message.channel.send(
      `🔄 **${isResuming ? 'Resuming' : 'Starting'} Channel History Crawl**\n\n` +
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
        await progressMessage.edit(
          `${emojiMap.crossError} **Channel History Crawl Cancelled**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${crawlStatus.messagesProcessed}\n` +
            `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered}\n\n` +
            `Crawl was cancelled by ${message.author.toString()}.\n\n` +
            `**💡 Tip:** Run the command again to resume from where you left off.`
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
          `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered}\n\n`,
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
        `${emojiMap.crossError} **Channel History Crawl Failed**\n\n` +
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
  channel: TextChannel,
  crawlStatus: CrawlStatus,
  progressMessage: Message | null,
  cancellationState: { isCancelled: boolean }
): Promise<void> => {
  let lastMessageId: string | undefined = crawlStatus.lastMessageId;
  let totalMessages = crawlStatus.messagesProcessed;

  // If resuming, we need to get the existing discovered worlds count
  // The duplicate detection system will handle tracking unique worlds
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
          `Crawling message ${totalMessages}: ${msg.id} at ${msg.createdAt.toISOString()}`
        );

        // Check if this message has already been processed by looking for any world IDs
        const worldId = await extractWorldIdFromMessage(msg.content);
        if (worldId) {
          // Check if this world has already been processed in this guild
          const originalMessageId = await getKvpValue(
            kvKeys.PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID,
            `${worldId}-${msg.guildId}`
          );

          if (originalMessageId && originalMessageId !== msg.id) {
            // This world has already been processed in another message, skip it
            logger.info(
              `Skipping already processed world in message ${msg.id}: ${worldId} (already processed in message ${originalMessageId})`
            );
            continue; // Skip to next message
          }

          // Use the existing duplicate detection system in silent mode for crawl operations
          const isDuplicate = await checkAndHandleDuplicate(msg, worldId, true);

          if (!isDuplicate) {
            // This is a new world, count it
            crawlStatus.worldsDiscovered = crawlStatus.worldsDiscovered + 1;
            logger.info(`World found in message ${msg.id}: ${worldId} (NEW)`);
          } else {
            logger.info(
              `World found in message ${msg.id}: ${worldId} (DUPLICATE)`
            );
          }

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
          progressMessage.channel.isSendable() &&
          !cancellationState.isCancelled
        ) {
          await progressMessage.edit(
            `🔄 **Channel History Crawl in Progress**\n\n` +
              `**📺 Channel:** ${channel}\n` +
              `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
              `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered.toLocaleString()}\n` +
              `**⏱️ Started:** <t:${Math.floor(new Date(crawlStatus.startTime).getTime() / 1000)}:F>\n\n` +
              `**React with ${emojiMap.crossError} to cancel the crawl.**`
          );
        }
      }

      // Log batch completion
      logger.info(
        `Completed batch processing. Total messages: ${totalMessages}, Unique worlds: ${crawlStatus.worldsDiscovered}`
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
      if (
        progressMessage &&
        progressMessage.channel.isSendable() &&
        !cancellationState.isCancelled
      ) {
        await progressMessage.edit(
          `🔄 **Channel History Crawl in Progress**\n\n` +
            `**📺 Channel:** ${channel}\n` +
            `**📊 Messages Processed:** ${totalMessages.toLocaleString()}\n` +
            `**🌍 New Worlds Discovered:** ${crawlStatus.worldsDiscovered.toLocaleString()}\n` +
            `**⏱️ Started:** <t:${Math.floor(new Date(crawlStatus.startTime).getTime() / 1000)}:F>\n\n` +
            `**React with ${emojiMap.crossError} to cancel the crawl.**`
        );
      }

      // Update crawl status
      if (!cancellationState.isCancelled) {
        crawlStatus.lastUpdateTime = new Date().toISOString();
        await set(kvKeys.CHANNEL_HISTORY_CRAWL_STATUS, {
          [channel.id]: crawlStatus
        });

        // Rate limiting
        await delay(RATE_LIMIT_DELAY);
      }
    } catch (error) {
      logger.error(`Error fetching messages for ${channel.id}:`, error);
      throw error;
    }
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
