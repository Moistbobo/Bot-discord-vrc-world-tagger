import { Message } from 'discord.js';

import watchForVRCWorldLinks from './messageCreate/watchForVRCWorldLinks';
import { watchChannel } from './messageCreate/watchChannel';
import { unWatchChannel } from './messageCreate/unWatchChannel';

const messageCreate = async (message: Message) => {
  if (message.content.startsWith('.watch')) {
    return watchChannel(message);
  } else if (message.content.startsWith('.unwatch')) {
    return unWatchChannel(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate;
