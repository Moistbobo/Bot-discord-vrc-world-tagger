import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  MessageReaction,
  Partials,
  User
} from 'discord.js';
import Config from './assets/config';
import messageCreate from './events/messageCreate';
import { onReactionForward } from './events/messageReactionAdd/onReactionForward';
import { onReactionToDelete } from './events/messageReactionAdd/onReactionToDelete';
import { onReactionForceRefetch } from './events/messageReactionAdd/onReactionForceRefetch';
import { onReactionUndoWorldTag } from './events/messageReactionAdd/onReactionUndoWorldTag';
import logger from './utils/logger';
import { crawlHighPriorityChannel } from './utils/highPriorityCrawl';
import { shouldIgnoreOwnBotMessage } from './botFilters';
import { isUserOnIgnoreList } from './utils/ignoreList';

// Message and reaction flows share policy (e.g. webhook vs self-bot). If you change
// message handling filters or world-link behavior, review src/events/messageReactionAdd/
// — see .pi/rules/message-processing-and-reactions.mdc.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.on(Events.MessageCreate, (message: Message) => {
  if (shouldIgnoreOwnBotMessage(message.author.id, client.user?.id)) return;
  return messageCreate(message);
});

client.on(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction, user: User) => {
    try {
      if (user.bot) return;
      if (await isUserOnIgnoreList(user.id)) return;
      await onReactionForward(reaction, user);
      await onReactionToDelete(reaction, user);
      await onReactionForceRefetch(reaction, user);
      await onReactionUndoWorldTag(reaction, user);
    } catch (error) {
      logger.error('Error in MessageReactionAdd handler:', error);
    }
  }
);

client.once(Events.ClientReady, () => {
  logger.info('Client ready with config');
  crawlHighPriorityChannel(client)
    .then((result) => {
      if (result.ok) {
        logger.info(
          `High priority channel crawl: scanned ${result.scanned}, added ${result.added}, removed ${result.removed}${result.truncated ? ' (truncated)' : ''}`
        );
      } else {
        logger.warn(
          `High priority channel crawl skipped: ${result.reason ?? 'unknown'}`
        );
      }
    })
    .catch((error) =>
      logger.error('High priority channel crawl failed:', error)
    );
});

client
  .login(Config.TOKEN)
  .then(() => logger.info('Bot logged in'))
  .catch((err) => logger.error('Failed to login:', err));

// Graceful shutdown: close API server and Discord client on SIGINT / SIGTERM
function handleShutdown(signal: string) {
  return async () => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await client.destroy();
      logger.info('Shutdown complete.');
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
    } finally {
      process.exit(0);
    }
  };
}

process.on('SIGINT', handleShutdown('SIGINT'));
process.on('SIGTERM', handleShutdown('SIGTERM'));
