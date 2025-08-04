import { Message } from 'discord.js';

import watchForVRCWorldLinks from './messageCreate/watchForVRCWorldLinks';
import { watchChannel } from './messageCreate/watchChannel';
import { unWatchChannel } from './messageCreate/unWatchChannel';
import androidSupport from './messageCreate/forwarding/androidSupport';
import maxSlots from './messageCreate/forwarding/maxSlots';
import clearForwardingChannels from './messageCreate/forwarding/clearForwardingChannels';

const messageCreate = async (message: Message) => {
  if (message.content.startsWith('.watch')) {
    return watchChannel(message);
  } else if (message.content.startsWith('.unwatch')) {
    return unWatchChannel(message);
  } else if (message.content.startsWith('.forwardAndroid')) {
    return androidSupport(message);
  } else if (message.content.startsWith('.forwardMaxSlots')) {
    return maxSlots(message);
  } else if (message.content.startsWith('.clearForwardingChannels')) {
    return clearForwardingChannels(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate;
