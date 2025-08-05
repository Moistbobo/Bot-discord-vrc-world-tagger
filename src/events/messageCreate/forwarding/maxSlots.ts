import { Message } from 'discord.js';
import setForwardingChannel from './setForwardingChannel';

const maxSlots = async (message: Message) => {
  await setForwardingChannel(message, 'playerCount');
};

export default maxSlots;
