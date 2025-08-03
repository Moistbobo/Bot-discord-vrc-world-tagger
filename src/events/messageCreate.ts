import { EmbedBuilder, Message, PartialGroupDMChannel } from 'discord.js';
import {
  extractWorldId,
  extractWorldLink,
  removeVRChatLink
} from '../utils/regex';
import logger from '../utils/logger';
import { vrchat } from '../utils/vrchat';
import { getSupportedPlatforms, hasAndroidSupport } from '../utils/helpers';

const messageCreate = async (message: Message) => {
  // check that message content contains only 1 vrchat world link

  const worldId = extractWorldId(message.content);

  if (!worldId) return;

  logger.info(`${message.content} detected as valid VRC World link ${worldId}`);

  // Fetch data from world id
  const { data } = await vrchat.getWorld({
    client: vrchat.client,
    path: { worldId }
  });

  logger.info(data);

  logger.info(`Retrieved World info for world ${data.name} ${data.id}`);

  const supportedPlatform = getSupportedPlatforms(data.unityPackages);

  const embed = new EmbedBuilder()
    .setTitle(`${data.name} by ${data.authorName}`)
    .setURL(extractWorldLink(message.content))
    .setThumbnail(data.imageUrl)
    .setDescription(removeVRChatLink(message.content))
    .addFields(
      {
        name: 'Max slots',
        value: `${data.capacity}`,
        inline: true
      },
      {
        name: 'Android Support',
        value: hasAndroidSupport(supportedPlatform) ? '✅' : '❌',
        inline: true
      }
    )
    .setFooter({
      iconURL: message.author.avatarURL(),
      text: `Submitted by ${message.author.displayName}`
    })
    .setTimestamp();

  if (!(message.channel instanceof PartialGroupDMChannel)) {
    message.channel.send({ embeds: [embed] });
  }
};

export default messageCreate;
