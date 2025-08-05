import { Client, Events, GatewayIntentBits } from 'discord.js';
import Config from './assets/config';
import messageCreate from './events/messageCreate';
import logger from './utils/logger';
import { vrchat } from './utils/vrchat';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.on(Events.MessageCreate, messageCreate);

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
