/**
 * Incoming commands and world-link handling. If you change message filters or link
 * processing, review reaction handlers under `src/events/messageReactionAdd/` for the
 * same assumptions (see `.pi/rules/message-processing-and-reactions.mdc`).
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
import { stats } from './stats';
import { crawlChannelHistory, getCrawlStatus } from './crawlHistory';
import lowCapacity from './forwarding/lowCapacity';
import addDeleteReact from './addDeleteReact';
import removeDeleteReact from './removeDeleteReact';
import setQualityChannel from './setQualityChannel';
import clearQualityChannel from './clearQualityChannel';
import { isUserOnIgnoreList } from '../../utils/ignoreList';
import { ignoreMe } from './ignoreMe';
import { unignoreMe } from './unignoreMe';

const messageCreate = async (message: Message) => {
  const trimmed = message.content.trim();

  if (await isUserOnIgnoreList(message.author.id)) {
    if (trimmed === '.unignoreMe' && !message.author.bot) {
      return unignoreMe(message);
    }
    return;
  }

  if (!message.author.bot) {
    if (trimmed === '.ignoreMe') {
      return ignoreMe(message);
    }
    if (trimmed === '.unignoreMe') {
      return unignoreMe(message);
    }
  }

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
  } else if (message.content.startsWith('.setQualityChannel')) {
    return withProtection(setQualityChannel)(message);
  } else if (message.content.startsWith('.clearQualityChannel')) {
    return withProtection(clearQualityChannel)(message);
  } else if (message.content.startsWith('.die')) {
    return withProtection(die)(message);
  } else if (message.content.startsWith('.stats')) {
    return stats(message);
  } else if (message.content.startsWith('.crawlHistory')) {
    return withProtection(crawlChannelHistory)(message);
  } else if (message.content.startsWith('.crawlStatus')) {
    return getCrawlStatus(message);
  } else {
    return watchForVRCWorldLinks(message);
  }
};

export default messageCreate;
