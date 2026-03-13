import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  MessageReaction,
  User
} from 'discord.js';
import Config from './assets/config';
import messageCreate from './events/messageCreate';
import { onReactionForward } from './events/messageReactionAdd/onReactionForward';
import logger from './utils/logger';
import { vrchat } from './utils/externalApi/vrchat';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.on(Events.MessageCreate, (message: Message) => {
  if (message.author.bot || message.author.id === client.user.id) return;
  return messageCreate(message);
});

client.on(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction, user: User) => {
    try {
      await onReactionForward(reaction, user);
    } catch (error) {
      logger.error('Error in MessageReactionAdd handler:', error);
    }
  }
);

client.once(Events.ClientReady, async () => {
  logger.info('Client ready with config');

  try {
    const { data: user } = await vrchat.getCurrentUser({ throwOnError: true });
    logger.info(
      `Authenticated with VRC API: ${user.displayName || user.username || 'Unknown User'}`
    );
  } catch (error) {
    logger.error('Failed to authenticate with VRC API:', error);
  }
});

client
  .login(Config.TOKEN)
  .then(() => logger.info('Bot logged in'))
  .catch((err) => logger.error('Failed to login:', err));
