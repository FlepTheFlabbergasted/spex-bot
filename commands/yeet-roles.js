import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import '../util/array.prototypes.js';

const COMMAND_NAME = 'yeet-roles';

/**
 * Remember to drag thte bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 *
 * Keepalive
 * https://pm2.keymetrics.io/docs/usage/quick-start/
 */
export const COMMAND_YEET_ROLES = {
  name: COMMAND_NAME,
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
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
    console.log(`Input roles: ${interaction.options.getString('roles')}\n`);

    const guildMemberCollection = await interaction.guild.members.fetch();
    const roleCollection = await interaction.guild.roles.fetch();

    const roleNamesToRemove = interaction.options
      .getString('roles')
      .split(',')
      .map((r) => r.trim());
    const roleNamesToRemoveStr = roleNamesToRemove.map((r) => `"${r}"`).joinReplaceLast(', ', 'and');
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
          ? `Couldn't find a role named "${unknownRoleNames[0]}" 🤷‍♀️ No changes made 🚫`
          : `Couldn't find any roles named ${unknownRoleNames.map((r) => `"${r}"`).joinReplaceLast(', ', 'and')} 🤷‍♀️ No changes made 🚫`;

      console.log(reply);
      return await interaction.reply(reply);
    }

    /**
     * Defer reply so we have time to run through all members if many
     * @see https://discordjs.guide/slash-commands/response-methods.html#deferred-responses
     */
    await interaction.deferReply();

    let membersWithRemovedRoles = [];
    let skippedMembers = [];
    guildMemberCollection.forEach((member) => {
      const memberName = member.displayName ?? member.user.username;

      // We do not touch the member who is using the command
      if (member.user.id === interaction.user.id) {
        return;
      }

      if (!member.moderatable) {
        console.log(`Not enough permissions to remove roles from ${memberName}, skipping`);
        skippedMembers.push(memberName);
        return;
      }

      console.log(`Removing role form ${memberName}`);
      member.roles.remove(rolesToRemove);
      membersWithRemovedRoles.push(memberName);
    });

    const removedMembersText = `Yeeted ${rolesToRemove.length > 1 ? 'roles' : 'role'} ${roleNamesToRemoveStr} from ${membersWithRemovedRoles.length} unsuspecting souls ✅`;
    const skippedMembersText = `Skipped ${skippedMembers.length > 1 ? 'members' : 'member'} ${skippedMembers.joinReplaceLast(', ', 'and')} since I don't have enough permissions to change their roles 💁‍♂️🚧`;
    const replyText = `${removedMembersText}${skippedMembers.length ? `\n${skippedMembersText}` : ''}`;

    console.log(`\n${replyText}`);
    return await interaction.editReply(replyText);
  },
};
