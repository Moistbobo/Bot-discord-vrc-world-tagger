import { Message } from 'discord.js';

import watchForVRCWorldLinks from './messageCreate/watchForVRCWorldLinks';
import { watchChannel } from './messageCreate/watchChannel';
import { unWatchChannel } from './messageCreate/unWatchChannel';
import androidSupport from './messageCreate/forwarding/androidSupport';
import maxSlots from './messageCreate/forwarding/maxSlots';
import clearForwardingChannels from './messageCreate/forwarding/clearForwardingChannels';
import withProtection from './messageCreate/wrappers/withProtection';
import die from './messageCreate/die';

const messageCreate = async (message: Message) => {
  if (message.content.startsWith('.watch')) {
    return withProtection(watchChannel)(message);
  } else if (message.content.startsWith('.unwatch')) {
    return withProtection(unWatchChannel)(message);
  } else if (message.content.startsWith('.forwardAndroid')) {
    return withProtection(androidSupport)(message);
  } else if (message.content.startsWith('.forwardMaxSlots')) {
    return withProtection(maxSlots)(message);
  } else if (message.content.startsWith('.clearForwardingChannels')) {
    return withProtection(clearForwardingChannels)(message);
  } else if (message.content.startsWith('.die')) {
    return withProtection(die)(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate;
