import { channelMention, Message } from 'discord.js';
import { get } from '../../../utils/jsonAsDb';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

const listReacts = async (message: Message) => {
  const config =
    (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) || {};
  const entries = Object.entries(config);

  if (!message.channel.isSendable()) return;

  if (entries.length === 0) {
    await message.channel.send(
      'No reaction forwarding is configured. Use `.forwardReact <emoji> #channel` to add one.'
    );
    return;
  }

  const lines = entries.map(
    ([emoji, channelId], i) =>
      `${i + 1}. ${emoji} → ${channelMention(channelId)}`
  );
  await message.channel.send(
    `**Reaction forwarding:**\n${lines.join('\n')}\n_Use \`.removeReact <index>\` to remove by number (e.g. \`.removeReact 1\`)._`
  );
};

export default listReacts;
