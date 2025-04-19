import { InteractionResponseType } from 'discord-interactions';
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { getRoles, getUserRoles } from '../util/discord-request.js';
import { getRandomEmoji } from '../util/get-random-emoji.js';

export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: ApplicationCommandType.ChatInput,
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
  contexts: [InteractionContextType.Guild],
};

export async function testCommand(req, res) {
  const interaction = req.body;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id;

  const roleIds = await getUserRoles({ userId, guildId });
  const roles = await getRoles({ guildId });

  // Send a message into the channel where command was triggered from
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      // Fetches a random emoji to send from a helper function
      content: `User roles ${roles
        .filter((role) => roleIds.includes(role.id))
        .map((role) => role.name)
        .join(', ')} ${getRandomEmoji()}`,
    },
  });
}
