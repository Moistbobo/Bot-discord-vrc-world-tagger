import { Client, Events, GatewayIntentBits } from 'discord.js';
import Config from './config';
import messageCreate from './events/messageCreate';
import logger from './utils/logger';
import './utils/vrchat';
import { vrchat } from './utils/vrchat';

const token = Config.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.on(Events.MessageCreate, async (message) => {
  return messageCreate(message);
});

client.once(Events.ClientReady, () => {
  logger.info(`Client ready with config: ${JSON.stringify(Config)}`);

  // authenticate vrchat api
  const { data: user } = await vrchat.getCurrentUser({ throwOnError: true });
  logger.info(`authenticated with VRC API: ${user}`);
});

client.login(token).then(async () => {
  logger.info(`Bot Logged in`);
});
