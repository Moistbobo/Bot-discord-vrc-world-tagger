import { Message } from 'discord.js';
import setForwardingChannel from './setForwardingChannel';

const androidSupport = async (message: Message) => {
  await setForwardingChannel(message, 'android');
};

export default androidSupport;
