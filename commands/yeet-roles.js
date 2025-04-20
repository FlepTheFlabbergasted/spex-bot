import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import '../util/array.prototypes.js';

/**
 * Remember to drag thte bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 */
export const COMMAND_YEET_ROLES = {
  name: 'yeet-roles',
  data: new SlashCommandBuilder()
    .setName('yeet-roles')
    .addStringOption((option) =>
      option
        .setName('roles')
        .setDescription('Roles to remove, separated by commas (e.g. Wizard, Rogue, Bard)')
        .setRequired(true)
    )
    .setDescription('Removes the roles you provide from all members (excluding admins and yourself)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
  execute: async (interaction) => {
    const guildMemberCollection = await interaction.guild.members.fetch();
    const roleCollection = await interaction.guild.roles.fetch();

    const roleNamesToRemove = interaction.options
      .getString('roles')
      .split(',')
      .map((r) => r.trim());
    const rolesToRemove = [];
    const unknownRoleNames = [];

    for (const roleName of roleNamesToRemove) {
      const role = roleCollection.find((r) => r.name === roleName);
      if (role) {
        rolesToRemove.push(role);
      } else {
        unknownRoleNames.push(roleName);
      }
    }

    if (unknownRoleNames.length > 0) {
      const reply =
        unknownRoleNames.length === 1
          ? `🤷‍♀️ Couldn't find a role named "${unknownRoleNames[0]}". No changes made 🚫`
          : `🤷‍♀️ Couldn't find any roles named ${unknownRoleNames.map((r) => `"${r}"`).joinReplaceLast(', ', 'and')}. No changes made 🚫`;
      return await interaction.reply(reply);
    }

    /**
     * Defer reply so we have time to run through all members if many
     * @see https://discordjs.guide/slash-commands/response-methods.html#deferred-responses
     */
    await interaction.deferReply();

    let membersWithRemovedRoles = [];
    guildMemberCollection.forEach((member) => {
      const memberName = member.displayName ?? member.user.username;

      if (member.user.id !== interaction.user.id) {
        if (!member.moderatable) {
          console.log(`Not enough permissions to remove roles from ${memberName}, skipping`);
          return;
        }

        member.roles.remove(rolesToRemove);
        membersWithRemovedRoles.push(memberName);
      }
    });

    return await interaction.editReply(
      `Yeeted ${rolesToRemove.length > 1 ? 'roles' : 'role'} ${rolesToRemove.map((r) => `"${r.name}"`).joinReplaceLast(', ', 'and')} from ${membersWithRemovedRoles.length} unsuspecting souls ✅`
    );
  },
};
