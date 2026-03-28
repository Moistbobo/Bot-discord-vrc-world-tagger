import { channelMention, EmbedBuilder, Message } from 'discord.js';
import { get } from '../../../utils/jsonAsDb';
import { getAll } from '../../../utils/jsonAsDb/handlers/persistentList';
import { kvKeys } from '../../../utils/jsonAsDb/types';

type ReactionForwardConfig = Record<string, string>;

const listReacts = async (message: Message) => {
  const config =
    (await get<ReactionForwardConfig>(kvKeys.REACTION_FORWARD_CHANNELS)) || {};
  const forwardEntries = Object.entries(config);
  const deleteEmojis = await getAll(kvKeys.REACT_TO_DELETE_EMOJIS);

  if (!message.channel.isSendable()) return;

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Reaction actions');

  if (forwardEntries.length === 0 && deleteEmojis.length === 0) {
    embed.setDescription(
      'No reaction actions are configured.\n\n' +
        '• **Forwarding** — `.forwardReact <emoji> #channel`\n' +
        '• **Delete on react** — `.addDeleteReact <emoji>` (bot messages in `.watchReacts` channels)'
    );
    await message.channel.send({ embeds: [embed] });
    return;
  }

  embed.setDescription(
    'These only run in channels where `.watchReacts` is enabled.'
  );

  if (forwardEntries.length > 0) {
    const lines = forwardEntries.map(
      ([emoji, channelId], i) =>
        `${i + 1}. ${emoji} → ${channelMention(channelId)}`
    );
    embed.addFields({
      name: 'Forwarding — emoji → channel',
      value:
        lines.join('\n') +
        '\n\n_Use `.removeReact <index>` to remove (e.g. `.removeReact 1`)._'
    });
  }

  if (deleteEmojis.length > 0) {
    const lines = deleteEmojis.map((emoji, i) => `${i + 1}. ${emoji}`);
    embed.addFields({
      name: 'React to delete — bot messages only',
      value:
        lines.join('\n') +
        '\n\n_Use `.removeDeleteReact <index>` to remove (e.g. `.removeDeleteReact 1`)._'
    });
  }

  await message.channel.send({ embeds: [embed] });
};

export default listReacts;
