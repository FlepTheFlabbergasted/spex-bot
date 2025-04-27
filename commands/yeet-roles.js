import {
  ActionRowBuilder,
  ComponentType,
  InteractionContextType,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import '../util/array.prototypes.js';

const COMMAND_NAME = 'yeet-roles';

/**
 * Remember to drag thte bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 *
 * Keepalive
 * https://pm2.keymetrics.io/docs/usage/quick-start/
 *
 */
export const COMMAND_YEET_ROLES = {
  name: COMMAND_NAME,
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Removes the roles you select from all members (excluding yourself and bots)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
  /**
   *
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  execute: async (interaction) => {
    const guildMemberCollection = await interaction.guild.members.fetch();
    const roleCollection = await interaction.guild.roles.fetch();

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(interaction.id)
      .setPlaceholder('Select roles to remove from members')
      .setMinValues(1)
      .setMaxValues(roleCollection.size);
    const actionRow = new ActionRowBuilder().setComponents(roleMenu);

    const reply = await interaction.reply({ components: [actionRow] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.RoleSelect,
      filter: (i) => i.user.id === interaction.user.id && i.customId === interaction.id,
      time: 300_000, // Keep collection response open for 5 minutes
      max: 1, // Max 1 response
    });

    collector.on('end', async (roleInteractionCollection) => {
      const selectedRoleIds = roleInteractionCollection.first()?.values || [];
      const selectedRoleNames = selectedRoleIds.map((roleId) => roleCollection.get(roleId)?.name);
      const selectedRoleNamesStr = selectedRoleNames.map((r) => `*${r}*`).joinReplaceLast(', ', 'and');

      if (selectedRoleNames.length > 0) {
        const selectionStr = `You selected ${selectedRoleNames.length > 1 ? 'roles' : 'role'} ${selectedRoleNamesStr} to be removed from members 🙋‍♂️🙋‍♀️\nGoing at it now... 🔪`;

        console.log(`${selectionStr}\n`);
        await interaction.editReply({ content: selectionStr, components: [] });
      } else {
        const noSelectionStr = 'You did not select any roles in time, bye! 👋';

        console.log(`${noSelectionStr}\n`);
        await interaction.editReply({ content: noSelectionStr, components: [] });
        return;
      }

      let membersWithRemovedRoles = [];
      let skippedMembers = [];

      guildMemberCollection.forEach(async (member) => {
        const memberName = `*${member.displayName ?? member.user.username}*`;

        // We do not touch the member who is using the command
        if (member.user.id === interaction.user.id) {
          return;
        }

        // Bots cannot remove other bots' roles
        if (member.user.bot) {
          return;
        }

        if (!member.moderatable) {
          console.log(`Not enough permissions to remove roles from ${memberName}, skipping`);
          skippedMembers.push(memberName);
          return;
        }

        try {
          console.log(`Removing role form ${memberName}`);
          membersWithRemovedRoles.push(memberName);
          await member.roles.remove(selectedRoleIds);
        } catch (error) {
          console.log(error);
        }
      });

      const removedRolesText = `Yeeted ${selectedRoleIds.length > 1 ? 'roles' : 'role'} ${selectedRoleNamesStr} from ${membersWithRemovedRoles.length} unsuspecting souls ✅`;
      const noRolesRemovedText = `I didn't manage to remove any roles from anyone 🤷‍♂️`;

      const skippedMembersText = `-# (Skipped ${skippedMembers.length > 1 ? 'members' : 'member'} ${skippedMembers.joinReplaceLast(', ', 'and')} since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
      const tooManySkippedMembersText = `-# (Skipped ${skippedMembers.length} members since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
      const skippedText = skippedMembers.length
        ? skippedMembers.length >= 0
          ? `\n${tooManySkippedMembersText}`
          : `\n${skippedMembersText}`
        : '';

      const replyText = `${membersWithRemovedRoles.length === 0 ? noRolesRemovedText : removedRolesText}${skippedText}`;

      console.log(`\n${replyText}`);
      await interaction.followUp(replyText);
    });
  },
};
