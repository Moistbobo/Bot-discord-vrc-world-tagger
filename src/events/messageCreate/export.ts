import { Message, AttachmentBuilder } from 'discord.js';
import logger from '../../utils/logger';
import { getAll } from '../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../utils/jsonAsDb/types';
import { vrchat } from '../../utils/externalApi/vrchat';
import { emojiMap } from '../../assets/icons';
import Config from '../../assets/config';

const RATE_LIMIT_DELAY = Config.EXPORT_RATE_LIMIT; // milliseconds

// Global state to prevent concurrent full exports
let isFullExportRunning = false;

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to extract all platforms from unity packages
const extractAllPlatforms = (unityPackages: any[] | undefined): string => {
  if (!unityPackages || unityPackages.length === 0) {
    return 'Unknown';
  }

  // Extract all unique platforms
  const platforms = [
    ...new Set(unityPackages.map((pkg) => pkg.platform).filter(Boolean))
  ];

  if (platforms.length === 0) {
    return 'Unknown';
  }

  return platforms.length === 1 ? platforms[0] : platforms.join(' ');
};

// Helper function to fetch world data with timeout
const fetchWorldDataWithTimeout = async (
  worldId: string,
  timeoutMs: number = 10000
) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const { data } = await vrchat.getWorld({
      client: vrchat.client,
      path: { worldId }
    });

    clearTimeout(timeoutId);
    return data;
  } catch (error) {
    // Enhanced error logging for API failures
    if (error.name === 'AbortError') {
      logger.error(`Request timeout for world ${worldId} after ${timeoutMs}ms`);
    } else if (error.response) {
      // HTTP error response
      logger.error(`VRChat API error for world ${worldId}:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        worldId: worldId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error.request) {
      // Network error
      logger.error(`Network error for world ${worldId}:`, {
        worldId: worldId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Other errors
      logger.error(`Unexpected error for world ${worldId}:`, {
        worldId: worldId,
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      });
    }
    return null;
  }
};

export const exportWorlds = async (message: Message) => {
  try {
    // Get all processed worlds
    const processedWorlds = await getAll(kvKeys.PROCESSED_WORLDS);

    if (processedWorlds.length === 0) {
      if (message.channel.isSendable()) {
        await message.channel.send('📭 No worlds have been processed yet.');
      }
      return;
    }

    // Create simple CSV with world IDs and URLs
    const csvHeader = 'Index,World ID,World URL\n';
    const csvRows = processedWorlds
      .map(
        (worldId, index) =>
          `${index + 1},${worldId},https://vrchat.com/home/world/${worldId}`
      )
      .join('\n');
    const csvContent = csvHeader + csvRows;

    // Create attachment with descriptive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const attachment = new AttachmentBuilder(Buffer.from(csvContent, 'utf-8'), {
      name: `vrchat_world_ids_export_${timestamp}.csv`
    });

    // Send the file with information
    if (message.channel.isSendable()) {
      await message.channel.send({
        content:
          `📊 **VRChat World IDs Export Complete!**\n\n` +
          `**📈 Total Worlds:** ${processedWorlds.length}\n` +
          `**📁 File Format:** CSV with world IDs and direct links\n\n` +
          `The attached CSV contains world IDs with direct VRChat world URLs for easy access. Use \`.exportFull\` for detailed world information.`,
        files: [attachment]
      });
    }

    logger.info(
      `World IDs export completed by ${message.author.tag} - ${processedWorlds.length} world IDs exported`
    );
  } catch (error) {
    logger.error('Failed to export world IDs:', {
      error: error.message,
      errorType: error.name,
      errorStack: error.stack,
      exportAuthor: message.author.tag,
      exportChannel: message.channelId,
      timestamp: new Date().toISOString()
    });

    if (message.channel.isSendable()) {
      await message.channel.send(
        '❌ Failed to export world IDs. Please try again later.'
      );
    }
  }
};

export const exportWorldsFull = async (message: Message) => {
  // Check if another full export is already running
  if (isFullExportRunning) {
    if (message.channel.isSendable()) {
      await message.channel.send(
        '⏳ **Export Already in Progress**\n\n' +
          'Another full world export is currently running. Please wait for it to complete before starting a new one.\n\n' +
          'You can use `.export` for a quick world ID list, or wait for the current export to finish.'
      );
    }
    return;
  }

  // Set the running state
  isFullExportRunning = true;

  try {
    // Get all processed worlds
    const processedWorlds = await getAll(kvKeys.PROCESSED_WORLDS);

    if (processedWorlds.length === 0) {
      if (message.channel.isSendable()) {
        await message.channel.send('📭 No worlds have been processed yet.');
      }
      isFullExportRunning = false;
      return;
    }

    // Send initial message and store reference for editing
    let progressMessage: Message | null = null;
    if (message.channel.isSendable()) {
      progressMessage = await message.channel.send(
        `🔄 **Starting Full World Export...**\n\n` +
          `**📈 Total Worlds to Process:** ${processedWorlds.length}\n` +
          `**⏱️ Estimated Time:** ~${Math.ceil((processedWorlds.length * 1.5) / 60)} minutes\n` +
          `**📊 Progress:** 0/${processedWorlds.length} worlds processed\n\n` +
          `This will take some time due to VRChat API rate limits. I'll update this message with progress.\n\n` +
          `**📋 Error Details:** Any API errors will be collected and included in a separate text file.\n\n` +
          `**React with ${emojiMap.crossError} to cancel the export.**`
      );

      // Add the crossError emoji for cancellation
      await progressMessage.react(emojiMap.crossError);
    }

    // Set up reaction collector for cancellation
    let isCancelled = false;
    let reactionCollector: any = null;

    if (progressMessage) {
      reactionCollector = progressMessage.createReactionCollector({
        filter: (reaction, user) =>
          reaction.emoji.name === emojiMap.crossError &&
          user.id === message.author.id,
        time: 24 * 60 * 60 * 1000 // 24 hours
      });

      reactionCollector.on('collect', async () => {
        isCancelled = true;
        if (progressMessage && progressMessage.channel.isSendable()) {
          const errorFileNote =
            errorDetails.length > 0
              ? `\n\n**📋 Note:** ${errorDetails.length} errors were encountered before cancellation.`
              : '';

          await progressMessage.edit(
            `❌ **Full World Export Cancelled**\n\n` +
              `**📈 Worlds Processed:** ${processedCount}/${processedWorlds.length}\n` +
              `**✅ Successfully Fetched:** ${successCount}\n` +
              `**❌ API Errors:** ${errorCount}${errorFileNote}\n\n` +
              `Export was cancelled by ${message.author.toString()}.`
          );
        }
        logger.info(
          `Full world export cancelled by ${message.author.tag} after processing ${processedCount} worlds`
        );
      });
    }

    // Process worlds with rate limiting
    const worldData: Array<{
      index: number;
      worldId: string;
      name: string;
      authorName: string;
      capacity: number;
      platform: string;
      status: string;
    }> = [];

    // Collect detailed error information for text file output
    const errorDetails: Array<{
      index: number;
      worldId: string;
      errorType: string;
      errorMessage: string;
      timestamp: string;
    }> = [];

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < processedWorlds.length; i++) {
      // Check if export was cancelled
      if (isCancelled) {
        break;
      }

      const worldId = processedWorlds[i];
      processedCount++;

      try {
        // Fetch world data
        const world = await fetchWorldDataWithTimeout(worldId);

        if (world) {
          worldData.push({
            index: i + 1,
            worldId: world.id,
            name: world.name || 'Unknown',
            authorName: world.authorName || 'Unknown',
            capacity: world.capacity || 0,
            platform: extractAllPlatforms(world.unityPackages),
            status: 'Success'
          });
          successCount++;
        } else {
          worldData.push({
            index: i + 1,
            worldId: worldId,
            name: 'Failed to fetch',
            authorName: 'Failed to fetch',
            capacity: 0,
            platform: 'Unknown',
            status: 'API Error'
          });
          errorCount++;

          // Collect error details for text file
          errorDetails.push({
            index: i + 1,
            worldId: worldId,
            errorType: 'API Error',
            errorMessage: 'Failed to fetch world data from VRChat API',
            timestamp: new Date().toISOString()
          });

          // Log the API error for this specific world
          logger.error(
            `Failed to fetch world data for ${worldId} during export`,
            {
              worldId: worldId,
              exportIndex: i + 1,
              totalWorlds: processedWorlds.length,
              processedCount: processedCount,
              successCount: successCount,
              errorCount: errorCount,
              timestamp: new Date().toISOString()
            }
          );
        }

        // Progress update every 10 worlds by editing the original message
        if (
          processedCount % 10 === 0 ||
          processedCount === processedWorlds.length
        ) {
          if (
            progressMessage &&
            progressMessage.channel.isSendable() &&
            !isCancelled
          ) {
            const remainingTime = Math.ceil(
              ((processedWorlds.length - processedCount) *
                (RATE_LIMIT_DELAY / 1000)) /
                60
            );
            await progressMessage.edit(
              `🔄 **Full World Export in Progress...**\n\n` +
                `**📈 Total Worlds to Process:** ${processedWorlds.length}\n` +
                `**📊 Progress:** ${processedCount}/${processedWorlds.length} worlds processed\n` +
                `**✅ Successfully Fetched:** ${successCount}\n` +
                `**❌ API Errors:** ${errorCount}\n` +
                `**⏱️ Remaining:** ~${remainingTime} minutes\n\n` +
                `This will take some time due to VRChat API rate limits. I'll update this message with progress.\n\n` +
                `**📋 Error Details:** Any API errors will be collected and included in a separate text file.\n\n` +
                `**React with ${emojiMap.crossError} to cancel the export.**`
            );
          }
        }

        // Rate limiting delay (except for the last request)
        if (i < processedWorlds.length - 1) {
          await delay(RATE_LIMIT_DELAY);
        }
      } catch (error) {
        // Enhanced error logging for processing errors
        logger.error(`Error processing world ${worldId} during export:`, {
          worldId: worldId,
          exportIndex: i + 1,
          totalWorlds: processedWorlds.length,
          processedCount: processedCount,
          successCount: successCount,
          errorCount: errorCount,
          error: error.message,
          errorType: error.name,
          errorStack: error.stack,
          timestamp: new Date().toISOString()
        });

        worldData.push({
          index: i + 1,
          worldId: worldId,
          name: 'Error occurred',
          authorName: 'Error occurred',
          capacity: 0,
          platform: 'Unknown',
          status: 'Processing Error'
        });
        errorCount++;

        // Collect error details for text file
        errorDetails.push({
          index: i + 1,
          worldId: worldId,
          errorType: 'Processing Error',
          errorMessage: error.message || 'Unknown processing error occurred',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Clean up reaction collector
    if (reactionCollector) {
      reactionCollector.stop();
    }

    // If cancelled, don't generate CSV
    if (isCancelled) {
      return;
    }

    // Log final export statistics
    logger.info(`Full world export processing completed:`, {
      totalWorlds: processedWorlds.length,
      successCount: successCount,
      errorCount: errorCount,
      successRate: `${((successCount / processedWorlds.length) * 100).toFixed(2)}%`,
      exportAuthor: message.author.tag,
      exportChannel: message.channelId,
      timestamp: new Date().toISOString()
    });

    // Create CSV content with world information
    const csvHeader =
      'Index,World ID,World URL,World Name,Author Name,Capacity,Platform,Status\n';
    const csvRows = worldData
      .map(
        (world) =>
          `${world.index},${world.worldId},https://vrchat.com/home/world/${world.worldId},"${world.name.replace(/"/g, '""')}","${world.authorName.replace(/"/g, '""')}",${world.capacity},${world.platform},${world.status}`
      )
      .join('\n');
    const csvContent = csvHeader + csvRows;

    // Create CSV attachment with descriptive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvAttachment = new AttachmentBuilder(
      Buffer.from(csvContent, 'utf-8'),
      {
        name: `vrchat_worlds_full_export_${timestamp}.csv`
      }
    );

    // Create error details text file if there are errors
    let errorAttachment: AttachmentBuilder | null = null;
    if (errorDetails.length > 0) {
      const errorHeader =
        `VRChat World Export - Error Report\n` +
        `Generated: ${new Date().toISOString()}\n` +
        `Total Worlds: ${processedWorlds.length}\n` +
        `Successful: ${successCount}\n` +
        `Errors: ${errorCount}\n` +
        `Success Rate: ${((successCount / processedWorlds.length) * 100).toFixed(2)}%\n\n` +
        `Detailed Error Information:\n` +
        `========================\n\n`;

      const errorContent = errorDetails
        .map(
          (error) =>
            `[${error.index}] World ID: ${error.worldId}\n` +
            `Error Type: ${error.errorType}\n` +
            `Error Message: ${error.errorMessage}\n` +
            `Timestamp: ${error.timestamp}\n` +
            `---\n`
        )
        .join('\n');

      const fullErrorContent = errorHeader + errorContent;
      errorAttachment = new AttachmentBuilder(
        Buffer.from(fullErrorContent, 'utf-8'),
        {
          name: `vrchat_worlds_export_errors_${timestamp}.txt`
        }
      );
    }

    // Update the progress message to show completion
    if (progressMessage && progressMessage.channel.isSendable()) {
      const errorFileNote =
        errorDetails.length > 0
          ? `\n\n**📋 Generating error report file...**`
          : '';

      await progressMessage.edit(
        `✅ **Full World Export Complete!**\n\n` +
          `**📈 Total Worlds Processed:** ${processedWorlds.length}\n` +
          `**✅ Successfully Fetched:** ${successCount}\n` +
          `**❌ API Errors:** ${errorCount}${errorFileNote}\n\n` +
          `Generating CSV file...`
      );
    }

    // Send the final files with comprehensive information
    if (message.channel.isSendable()) {
      const files = [csvAttachment];
      if (errorAttachment) {
        files.push(errorAttachment);
      }

      const errorFileMessage = errorAttachment
        ? `\n\n**📋 Error Report:** A text file with detailed error information has also been attached for your review.`
        : '';

      await message.channel.send({
        content:
          `📊 **VRChat Full Worlds Export Complete!**\n\n` +
          `**📈 Total Worlds Processed:** ${processedWorlds.length}\n` +
          `**✅ Successfully Fetched:** ${successCount}\n` +
          `**❌ API Errors:** ${errorCount}\n` +
          `**📁 File Format:** CSV with world details${errorFileMessage}\n\n` +
          `The attached CSV contains world IDs, direct VRChat URLs, names, authors, capacity, platform, and status information. ` +
          `You can open this file in Excel, Google Sheets, or any spreadsheet application for analysis.`,
        files: files
      });
    }

    logger.info(
      `Full world export completed by ${message.author.tag} - ${processedWorlds.length} worlds exported (${successCount} success, ${errorCount} errors)`
    );
  } catch (error) {
    // Enhanced error logging for the full export function
    logger.error('Failed to export worlds full:', {
      error: error.message,
      errorType: error.name,
      errorStack: error.stack,
      exportAuthor: message.author.tag,
      exportChannel: message.channelId,
      timestamp: new Date().toISOString()
    });

    if (message.channel.isSendable()) {
      await message.channel.send(
        '❌ Failed to export worlds with full details. Please try again later.'
      );
    }
  } finally {
    // Always clear the running state when export finishes
    isFullExportRunning = false;
  }
};
