import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import '../util/array.prototypes.js';

const COMMAND_NAME = 'yeet-roles';
const INTERACTION_RESPONSE_TIMEOUT_MS = 120_000; // 2 minutes

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
   * @param {import('discord.js').ChatInputCommandInteraction} commandInteraction
   */
  execute: async (commandInteraction) => {
    console.log(`######### NEW STUFF`);

    const guildMemberCollection = await commandInteraction.guild.members.fetch();
    const roleCollection = await commandInteraction.guild.roles.fetch();

    const { cancelBtnBuilder, confirmBtnBuilder } = getCancelAndConffirmButtons(commandInteraction.id);
    const roleMenuBuilder = getRoleMenuBuilder(commandInteraction.id, roleCollection.size);

    const roleMenuRow = new ActionRowBuilder().setComponents(roleMenuBuilder);
    const buttonsRow = new ActionRowBuilder().setComponents(cancelBtnBuilder, confirmBtnBuilder);

    const interactionReply = await commandInteraction.reply({ components: [roleMenuRow, buttonsRow] });
    const collector = interactionReply.createMessageComponentCollector({
      filter: (i) => i.user.id === commandInteraction.user.id,
      time: INTERACTION_RESPONSE_TIMEOUT_MS, // Keep collection response open this long
    });

    let didUserCancelCommand = false;
    let selectedRoleIds = [];

    collector.on(
      'collect',
      async (componentInteraction) =>
        (didUserCancelCommand = await collectorOnCollect(
          commandInteraction,
          componentInteraction,
          roleMenuBuilder.toJSON().custom_id,
          roleMenuRow,
          cancelBtnBuilder,
          confirmBtnBuilder,
          selectedRoleIds,
          roleCollection,
          guildMemberCollection
        ))
    );

    collector.on('end', () => collectorOnEnd(commandInteraction, didUserCancelCommand));
  },
};

const collectorOnEnd = async (commandInteraction, didUserCancelCommand) => {
  console.log(`#### collectorOnEnd, didUserCancelCommand: `, await didUserCancelCommand);

  if (!didUserCancelCommand) {
    const timeoutText = `⌛ I didn't get a response within 2 minutes, bye! 👋`;
    console.log(timeoutText);

    await commandInteraction.deleteReply();
    await commandInteraction.followUp({
      content: timeoutText,
      components: [],
      flags: MessageFlags.Ephemeral,
    });
  }
};

const collectorOnCollect = async (
  commandInteraction,
  componentInteraction,
  roleMenuBuilderId,
  roleMenuRow,
  cancelBtnBuilder,
  confirmBtnBuilder,
  selectedRoleIds,
  roleCollection,
  guildMemberCollection
) => {
  {
    if (componentInteraction.customId === roleMenuBuilderId) {
      await componentInteraction.deferUpdate();

      const buttonActionRow = componentInteraction.message.components[1];
      const confirmButton = buttonActionRow.components.find((c) => c.customId === confirmBtnBuilder.toJSON().custom_id);

      // We now have values and we didn't have values before
      if (componentInteraction.values.length && !selectedRoleIds.length) {
        await componentInteraction.message.edit({
          components: [
            roleMenuRow,
            new ActionRowBuilder().setComponents(cancelBtnBuilder, confirmBtnBuilder.setDisabled(false)),
          ],
        });
        // Confirm button is not yet disabled
      } else if (!componentInteraction.values.length && !confirmButton.disabled) {
        await componentInteraction.message.edit({
          components: [
            roleMenuRow,
            new ActionRowBuilder().setComponents(cancelBtnBuilder, confirmBtnBuilder.setDisabled(true)),
          ],
        });
      }

      selectedRoleIds = componentInteraction.values;
    } else if (componentInteraction.customId === confirmBtnBuilder.toJSON().custom_id) {
      const selectedRoleNames = selectedRoleIds.map((roleId) => roleCollection.get(roleId)?.name);
      const selectedRoleNamesStr = selectedRoleNames.map((r) => `*${r}*`).joinReplaceLast(', ', 'and');

      const replyText = await removeRolesFromAllMembers(
        guildMemberCollection,
        commandInteraction,
        selectedRoleIds,
        selectedRoleNamesStr
      );

      console.log(replyText);
      await componentInteraction.update({ content: replyText, components: [] });
    } else if (componentInteraction.customId === cancelBtnBuilder.toJSON().custom_id) {
      const cancelText = `Command ${COMMAND_NAME} cancelled by user ❌`;
      console.log(cancelText);

      await componentInteraction.deferUpdate();
      await componentInteraction.deleteReply();
      await componentInteraction.followUp({
        content: cancelText,
        components: [],
        flags: MessageFlags.Ephemeral,
      });

      return true; //actionCancelled = true;
    }
  }
};

const getRoleMenuBuilder = (interactionId, nrOfRoles) => {
  return new RoleSelectMenuBuilder()
    .setCustomId(`role-menu-select${interactionId}`)
    .setPlaceholder('Select roles to remove from members')
    .setMinValues(0) // So we can disable the cfm button, but we really want atleast 1
    .setMaxValues(nrOfRoles);
};

const getCancelAndConffirmButtons = (interactionId) => {
  return {
    cancelBtnBuilder: new ButtonBuilder()
      .setCustomId(`cancel-button${interactionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
    confirmBtnBuilder: new ButtonBuilder()
      .setCustomId(`confirm-button${interactionId}`)
      .setLabel('Remove roles')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  };
};

async function removeRolesFromAllMembers(guildMemberCollection, interaction, selectedRoleIds, selectedRoleNamesStr) {
  let membersWithRemovedRoles = [];
  let skippedMembers = [];

  console.log(`Selected roles to remove from members: ${selectedRoleNamesStr}`);

  for (const member of guildMemberCollection.values()) {
    const memberName = `*${member.displayName ?? member.user.username}*`;

    // We do not touch the member who is using the command
    if (member.user.id === interaction.user.id) {
      break;
    }

    // Bots cannot remove other bots' roles
    if (member.user.bot) {
      break;
    }

    if (!member.moderatable) {
      console.log(`Not enough permissions to remove roles from ${memberName}, skipping`);
      skippedMembers.push(memberName);
      break;
    }

    try {
      console.log(`Removing roles from ${memberName}`);
      membersWithRemovedRoles.push(memberName);
      await member.roles.remove(selectedRoleIds);
    } catch (error) {
      console.log(error);
    }
  }

  const removedRolesText = `Yeeted ${selectedRoleIds.length > 1 ? 'roles' : 'role'} ${selectedRoleNamesStr} from ${membersWithRemovedRoles.length} unsuspecting ${membersWithRemovedRoles.length > 1 ? 'souls' : 'soul'} ✅`;
  const noRolesRemovedText = `I didn't manage to remove any roles from anyone 🤷‍♂️`;

  const skippedMembersText = `-# (Skipped ${skippedMembers.length > 1 ? 'members' : 'member'} ${skippedMembers.joinReplaceLast(', ', 'and')} since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
  const tooManySkippedMembersText = `-# (Skipped ${skippedMembers.length} members since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
  const skippedText = skippedMembers.length
    ? skippedMembers.length >= 0
      ? `\n${tooManySkippedMembersText}`
      : `\n${skippedMembersText}`
    : '';

  return `${membersWithRemovedRoles.length === 0 ? noRolesRemovedText : removedRolesText}${skippedText}`;
}
