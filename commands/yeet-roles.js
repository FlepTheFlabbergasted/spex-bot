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

const COMMAND_CANCELLED_BY_USER_EVENT_NAME = 'cancelledByUser';
const TIMEOUT_TEXT = `⌛ I didn't get a response within 2 minutes, bye! 👋`;
const CANCEL_TEXT = `Command ${COMMAND_NAME} was cancelled by user ❌`;

/**
 * Remember to drag the bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 *
 * Keepalive
 * https://pm2.keymetrics.io/docs/usage/quick-start/
 *
 * Reminder to self:
 * Start with pm2 on PI
 * To update, run locally, shut of other instances on the PI
 * use `npm run start:watch` to test
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
    const state = { botMember: commandInteraction.guild.members.me, selectedRoleIds: [] };

    const guildMemberCollection = filterGuildMembers(
      await commandInteraction.guild.members.fetch(),
      commandInteraction.user.id
    );
    const roleCollection = filterAndSortGuildRoles(await commandInteraction.guild.roles.fetch());

    const { cancelBtnBuilder, confirmBtnBuilder } = getCancelAndConffirmButtons(commandInteraction.id);
    const roleMenuBuilder = getRoleMenuBuilder(commandInteraction.id, roleCollection);

    const roleMenuRow = new ActionRowBuilder().setComponents(roleMenuBuilder);
    const buttonsRow = new ActionRowBuilder().setComponents(cancelBtnBuilder, confirmBtnBuilder);

    const interactionReply = await commandInteraction.reply({ components: [roleMenuRow, buttonsRow] });
    const collector = interactionReply.createMessageComponentCollector({
      // Only listen to the user that called the command
      filter: (i) => i.user.id === commandInteraction.user.id,
      // Keep collection response open this long
      time: INTERACTION_RESPONSE_TIMEOUT_MS,
    });

    collector.on('collect', async (componentInteraction) =>
      collectorOnCollect(
        collector,
        commandInteraction,
        componentInteraction,
        roleMenuBuilder.toJSON().custom_id,
        roleMenuRow,
        cancelBtnBuilder,
        confirmBtnBuilder,
        state,
        roleCollection,
        guildMemberCollection
      )
    );

    collector.on('end', (_collected, reason) => collectorOnEnd(commandInteraction, reason));
  },
};

const collectorOnEnd = async (commandInteraction, reason) => {
  let followUpText = reason === COMMAND_CANCELLED_BY_USER_EVENT_NAME ? CANCEL_TEXT : TIMEOUT_TEXT;

  console.log(followUpText);

  await commandInteraction.deleteReply();
  await commandInteraction.followUp({
    content: followUpText,
    components: [],
    flags: MessageFlags.Ephemeral,
  });
};

const collectorOnCollect = async (
  collector,
  commandInteraction,
  componentInteraction,
  roleMenuBuilderId,
  roleMenuRow,
  cancelBtnBuilder,
  confirmBtnBuilder,
  state,
  roleCollection,
  guildMemberCollection
) => {
  switch (componentInteraction.customId) {
    case roleMenuBuilderId:
      await onRoleSelectBlur(componentInteraction, cancelBtnBuilder, confirmBtnBuilder, roleMenuRow, state);
      break;
    case confirmBtnBuilder.toJSON().custom_id:
      await onConfirmBtnClick(
        commandInteraction,
        componentInteraction,
        guildMemberCollection,
        roleCollection,
        state.selectedRoleIds
      );
      break;
    case cancelBtnBuilder.toJSON().custom_id:
      collector.stop(COMMAND_CANCELLED_BY_USER_EVENT_NAME);
      break;
    default:
      console.error(`Unhandled component interaction with id "${componentInteraction.customId}"`);
      break;
  }
};

const onRoleSelectBlur = async (componentInteraction, cancelBtnBuilder, confirmBtnBuilder, roleMenuRow, state) => {
  const buttonActionRow = componentInteraction.message.components[1];
  const confirmButton = buttonActionRow.components.find((c) => c.customId === confirmBtnBuilder.toJSON().custom_id);

  await componentInteraction.deferUpdate();

  // We now have values and we didn't have values before, so enable the cfm button
  if (componentInteraction.values.length && !state.selectedRoleIds.length) {
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

  state.selectedRoleIds = componentInteraction.values;
};

const onConfirmBtnClick = async (
  commandInteraction,
  componentInteraction,
  guildMemberCollection,
  roleCollection,
  selectedRoleIds
) => {
  const roleCollectionRemovedManagedRoles = roleCollection.filter((role) => !role.managed);
  selectedRoleIds = selectedRoleIds.filter((roleId) => roleCollectionRemovedManagedRoles.get(roleId));
  const selectedRoleNames = selectedRoleIds.map((roleId) => roleCollectionRemovedManagedRoles.get(roleId)?.name);
  const selectedRoleNamesStr = selectedRoleNames.map((r) => `*${r}*`).joinReplaceLast(', ', 'and');

  const replyText = await removeRolesFromAllMembers(
    guildMemberCollection,
    commandInteraction,
    selectedRoleIds,
    selectedRoleNamesStr
  );

  console.log(replyText);
  await componentInteraction.update({ content: replyText, components: [] });
};

const getRoleMenuBuilder = (interactionId, roleCollection) => {
  return new RoleSelectMenuBuilder()
    .setCustomId(`role-menu-select${interactionId}`)
    .setPlaceholder('Select roles to remove from members')
    .setMinValues(0) // So we can disable the cfm button, but we really want atleast 1
    .setMaxValues(roleCollection.size);
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

const filterGuildMembers = (guildMemberCollection, commandCallerUserId) => {
  let filteredMemberNamesAndReason = [];

  const filteredMemberCollection = guildMemberCollection.filter((member) => {
    // We do not touch the member who is using the command
    if (member.user.id === commandCallerUserId) {
      filteredMemberNamesAndReason.push({ name: member.displayName, reason: 'Command caller' });
      return false;
    }

    // Bots cannot remove other bots' roles
    if (member.user.bot) {
      filteredMemberNamesAndReason.push({ name: member.displayName, reason: 'Bot' });
      return false;
    }

    if (!member.moderatable) {
      filteredMemberNamesAndReason.push({ name: member.displayName, reason: 'Not moderatable' });
      return false;
    }
  });

  console.log(`========= Filtered members =========`);
  console.table(filteredMemberNamesAndReason);

  return filteredMemberCollection;
};

const filterAndSortGuildRoles = (roleCollection) => {
  let filteredRoleNamesAndReason = [];

  const filteredRoleCollection = roleCollection.filter((role) => {
    if (role.name === '@everyone') {
      filteredRoleNamesAndReason.push({ name: role.name, reason: 'You know why' });
      return false;
    }

    // Managed roles (external ones, like bot roles) can't be removed/edited
    if (role.managed) {
      filteredRoleNamesAndReason.push({ name: role.name, reason: 'Managed role' });
      return false;
    }

    // The bot does not have permission and/or hierarchy (bot role must be higher) to manage this role
    if (!role.editable) {
      filteredRoleNamesAndReason.push({ name: role.name, reason: 'Not editable' });
      return false;
    }

    return true;
  });

  const filteredAndSortedRoleCollection = filteredRoleCollection.sorted((roleA, roleB) =>
    roleA.name.localeCompare(roleB.name)
  );

  console.log(`========= Filtered roles =========`);
  console.table(filteredRoleNamesAndReason);

  return filteredAndSortedRoleCollection;
};

async function removeRolesFromAllMembers(guildMemberCollection, interaction, selectedRoleIds, selectedRoleNamesStr) {
  let membersWithRemovedRoles = [];

  console.log(`Selected roles to remove from members: ${selectedRoleNamesStr}`);

  for (const member of guildMemberCollection.values()) {
    const memberName = `*${member.displayName ?? member.user.username}*`;

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

  // const skippedMembersText = `-# (Skipped ${skippedMembers.length > 1 ? 'members' : 'member'} ${skippedMembers.joinReplaceLast(', ', 'and')} since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
  // const tooManySkippedMembersText = `-# (Skipped ${skippedMembers.length} members since I don't have enough permissions to change their roles 💁‍♂️🚧)`;
  // const skippedText = skippedMembers.length
  //   ? skippedMembers.length >= 0
  //     ? `\n${tooManySkippedMembersText}`
  //     : `\n${skippedMembersText}`
  //   : '';

  return `${membersWithRemovedRoles.length === 0 ? noRolesRemovedText : removedRolesText}`;
}
