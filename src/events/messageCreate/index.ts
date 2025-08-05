import { Message } from 'discord.js';

import watchForVRCWorldLinks from './watchForVRCWorldLinks';
import { watchChannel } from './watchChannel';
import { unWatchChannel } from './unWatchChannel';
import androidSupport from './forwarding/androidSupport';
import maxSlots from './forwarding/maxSlots';
import clearForwardingChannels from './forwarding/clearForwardingChannels';
import withProtection from './wrappers/withProtection';
import die from './die';

const messageCreate = async (message: Message) => {
  if (message.content.startsWith('.watch')) {
    // Add a channel to the watch list for tagging.
    return withProtection(watchChannel)(message);
  } else if (message.content.startsWith('.unwatch')) {
    // Remove a channel from the watch list.
    return withProtection(unWatchChannel)(message);
  } else if (message.content.startsWith('.forwardAndroid')) {
    // Set a channel as forward target for android compatible worlds. Subsequent calls will overwrite the last.
    return withProtection(androidSupport)(message);
  } else if (message.content.startsWith('.forwardMaxSlots')) {
    // Set a channel as forward target for worlds with >=60 people. Subsequent calls will overwrite the last.
    return withProtection(maxSlots)(message);
  } else if (message.content.startsWith('.clearForwardingChannels')) {
    // Clear the forwarding targets (done like this because I am lazy)
    return withProtection(clearForwardingChannels)(message);
  } else if (message.content.startsWith('.die')) {
    // Kills the bot before it kills us
    return withProtection(die)(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate; 