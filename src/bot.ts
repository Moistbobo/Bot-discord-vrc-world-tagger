import { Client, Events, GatewayIntentBits } from 'discord.js';
import Config from './config';
import messageCreate from './events/messageCreate';
import logger from './utils/logger';
import './utils/vrchat';

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
  if (message.content === '.die') {
    if (message.channel.isSendable()) {
      message.channel.send(
        'https://cdn.discordapp.com/attachments/602355380357431307/1401664289655357552/ty4ever.png?ex=68911918&is=688fc798&hm=beca1b07d15cb9e0b12456b52c47de2f958aa9ad1321799abb7f2a0c9cb4e7e6&'
      );
    }

    logger.info(`.die command received. Thank you forever.`);
    await client.destroy();
    process.exit(0);
  }

  return messageCreate(message);
});

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Client ready: ${readyClient}`);
});

client.login(token).then(async () => {
  logger.info(`Bot Logged in`);

  // authenticate vrchat api
  // const { data: user } = await vrchat.getCurrentUser({ throwOnError: true });
  // logger.info(`authenticated with VRC API: ${user}`);
});
