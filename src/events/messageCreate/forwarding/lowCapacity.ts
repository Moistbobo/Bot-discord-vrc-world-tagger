import { Message } from 'discord.js';
import setForwardingChannel from './setForwardingChannel';

const lowCapacity = async (message: Message) => {
  await setForwardingChannel(message, 'lowCapacity');
};

export default lowCapacity;
