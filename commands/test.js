import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

/**
 * Remember to drag thte bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 */
export const COMMAND_TEST = {
  name: 'test',
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Does whatever you want it to babes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
  execute: async (interaction) => {
    const guildMemberCollection = await interaction.guild.members.fetch();
    const roleCollection = await interaction.guild.roles.fetch();
    const guildMembersNoBots = guildMemberCollection.filter((member) => !member.user.bot);
    const rolesToRemove = Array.from(
      roleCollection.filter((role) => role.name !== 'Test' && role.name !== '@everyone').values()
    ).filter((role) => !!role);

    rolesToRemove.forEach((role) => console.log([role.id, role.name]));

    let membersWithRemovedRoles = [];
    guildMembersNoBots.forEach((member) => {
      const memberName = member.displayName ?? member.user.username;
      if (!interaction.member.moderatable) {
        console.log(`I do not have enough permission to remove roles from ${memberName}`);
        return;
      }

      if (member.user.id !== interaction.user.id && interaction.member.moderatable) {
        console.log(`Removing roles for ${memberName}`);
        member.roles.remove(rolesToRemove);
        membersWithRemovedRoles.push(memberName);
      }
    });

    return await interaction.reply(
      `Removing roles ${rolesToRemove.map((role) => role.name).join(', ')} for members ${membersWithRemovedRoles.join(', ')}`
    );
  },
};
