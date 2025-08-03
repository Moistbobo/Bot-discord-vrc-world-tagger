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

client.on(Events.MessageCreate, messageCreate);

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Client ready: ${readyClient}`);
});

client.login(token).then(async () => {
  logger.info(`Bot Logged in`);

  // authenticate vrchat api
  // const { data: user } = await vrchat.getCurrentUser({ throwOnError: true });
  // logger.info(`authenticated with VRC API: ${user}`);
});
