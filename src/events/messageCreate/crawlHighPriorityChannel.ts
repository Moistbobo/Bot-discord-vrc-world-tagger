import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { crawlHighPriorityChannel as runCrawl } from '../../utils/highPriorityCrawl';

const crawlHighPriorityChannel = async (message: Message) => {
  try {
    const result = await runCrawl(message.client);
    if (message.channel.isSendable()) {
      if (result.ok) {
        await message.channel.send(
          `Crawl complete: scanned ${result.scanned} messages, added ${result.added}, removed ${result.removed}.` +
            (result.truncated
              ? ' (capped at 5000 messages — run again or increase the cap)'
              : '')
        );
      } else if (result.reason === 'not-configured') {
        await message.channel.send(
          'No high priority channel is configured. Use `.setHighPriorityChannel #channel` first.'
        );
      } else if (result.reason === 'not-found') {
        await message.channel.send(
          'The configured high priority channel could not be found.'
        );
      } else {
        await message.channel.send(
          'A high priority channel crawl is already in progress. Try again shortly.'
        );
      }
    }
  } catch (error) {
    logger.error('Failed to crawl high priority channel:', error);
    if (message.channel.isSendable()) {
      await message.channel.send(
        'Failed to crawl the high priority channel. Please try again.'
      );
    }
  }
};

export default crawlHighPriorityChannel;
