/**
 * Incoming commands and world-link handling. If you change message filters or link
 * processing, review reaction handlers under `src/events/messageReactionAdd/` for the
 * same assumptions (see `.cursor/rules/message-processing-and-reactions.mdc`).
 */
import { Message } from 'discord.js';

import watchForVRCWorldLinks from './watchForVRCWorldLinks';
import { watchChannel } from './watchChannel';
import { unWatchChannel } from './unWatchChannel';
import { watchReacts } from './watchReacts';
import { unwatchReacts } from './unwatchReacts';
import androidSupport from './forwarding/androidSupport';
import maxSlots from './forwarding/maxSlots';
import forwardReact from './forwarding/forwardReact';
import listReacts from './forwarding/listReacts';
import removeReact from './forwarding/removeReact';
import clearForwardingChannels from './forwarding/clearForwardingChannels';
import withProtection from './wrappers/withProtection';
import die from './die';
import { remove } from './remove';
import { stats } from './stats';
import { exportWorlds, exportWorldsFull } from './export';
import { crawlChannelHistory, getCrawlStatus } from './crawlHistory';
import lowCapacity from './forwarding/lowCapacity';
import addDeleteReact from './addDeleteReact';
import removeDeleteReact from './removeDeleteReact';

const messageCreate = async (message: Message) => {
  if (message.content.startsWith('.watchReacts')) {
    return withProtection(watchReacts)(message);
  } else if (message.content.startsWith('.unwatchReacts')) {
    return withProtection(unwatchReacts)(message);
  } else if (message.content.startsWith('.watch')) {
    return withProtection(watchChannel)(message);
  } else if (message.content.startsWith('.unwatch')) {
    return withProtection(unWatchChannel)(message);
  } else if (message.content.startsWith('.forwardAndroid')) {
    return withProtection(androidSupport)(message);
  } else if (message.content.startsWith('.forwardMaxSlots')) {
    return withProtection(maxSlots)(message);
  } else if (message.content.startsWith('.forwardReact')) {
    return withProtection(forwardReact)(message);
  } else if (message.content.startsWith('.listReacts')) {
    return withProtection(listReacts)(message);
  } else if (message.content.startsWith('.removeReact')) {
    return withProtection(removeReact)(message);
  } else if (message.content.startsWith('.addDeleteReact')) {
    return withProtection(addDeleteReact)(message);
  } else if (message.content.startsWith('.removeDeleteReact')) {
    return withProtection(removeDeleteReact)(message);
  } else if (message.content.startsWith('.forwardLowCap')) {
    return withProtection(lowCapacity)(message);
  } else if (message.content.startsWith('.clearForwardingChannels')) {
    return withProtection(clearForwardingChannels)(message);
  } else if (message.content.startsWith('.remove')) {
    return withProtection(remove)(message);
  } else if (message.content.startsWith('.die')) {
    return withProtection(die)(message);
  } else if (message.content.startsWith('.stats')) {
    return stats(message);
  } else if (message.content.startsWith('.exportFull')) {
    return withProtection(exportWorldsFull)(message);
  } else if (message.content.startsWith('.export')) {
    return exportWorlds(message);
  } else if (message.content.startsWith('.crawlHistory')) {
    return withProtection(crawlChannelHistory)(message);
  } else if (message.content.startsWith('.crawlStatus')) {
    return getCrawlStatus(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate;
