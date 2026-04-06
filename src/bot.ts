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
import logger from './utils/logger';
import { isCurrentUser, vrchat } from './utils/externalApi/vrchat';
import { shouldIgnoreOwnBotMessage } from './botFilters';

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
      await onReactionForward(reaction, user);
      await onReactionToDelete(reaction, user);
      await onReactionForceRefetch(reaction, user);
    } catch (error) {
      logger.error('Error in MessageReactionAdd handler:', error);
    }
  }
);

client.once(Events.ClientReady, async () => {
  logger.info('Client ready with config');

  try {
    const { data } = await vrchat.getCurrentUser({ throwOnError: true });
    if (!data || !isCurrentUser(data)) {
      logger.error('VRC API returned RequiresTwoFactorAuth or no data');
      return;
    }
    logger.info(`Authenticated with VRC API: ${data.displayName}`);
  } catch (error) {
    logger.error('Failed to authenticate with VRC API:', error);
  }
});

client
  .login(Config.TOKEN)
  .then(() => logger.info('Bot logged in'))
  .catch((err) => logger.error('Failed to login:', err));
