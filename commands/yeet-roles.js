import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import '../util/array.prototypes.js';

const COMMAND_NAME = 'yeet-roles';
const INTERACTION_RESPONSE_TIMEOUT_MS = 120_000; // 2 minutes

const NO_ROLES_TO_REMOVE_EVENT_NAME = 'noRolesToRemove';
const NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME = 'noMembersLeftToManage';
const CANCELLED_BY_USER_EVENT_NAME = 'cancelledByUser';

const STRING_SELECT_MENU_COMPONENT_ID = 'stringSelectMenuId';
const CANCEL_BUTTON_COMPONENT_ID = 'cancelButtonId';
const CONFIRM_BUTTON_COMPONENT_ID = 'confirmButtonId';

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
    const state = {
      botMember: commandInteraction.guild.members.me,
      selectedRoleIds: [],
      guildMemberCollection: filterGuildMembers(
        await commandInteraction.guild.members.fetch(),
        commandInteraction.user.id
      ),
      availableRolesCollection: filterAndSortGuildRoles(await commandInteraction.guild.roles.fetch()),
    };

    if (state.availableRolesCollection.size === 0) {
      await endCommand(commandInteraction, NO_ROLES_TO_REMOVE_EVENT_NAME);
      return;
    } else if (state.guildMemberCollection.size === 0) {
      await endCommand(commandInteraction, NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME);
      return;
    }

    const interactionReply = await commandInteraction.reply({
      components: [
        getStringSelectActionRow(state.availableRolesCollection, state.selectedRoleIds),
        getButtonsActionRow(true),
      ],
    });

    const collector = interactionReply.createMessageComponentCollector({
      // Only listen to the user that called the command
      filter: (i) => i.user.id === commandInteraction.user.id,
      // Keep collection response open this long
      time: INTERACTION_RESPONSE_TIMEOUT_MS,
    });

    collector.on('collect', async (componentInteraction) => collectorOnCollect(collector, componentInteraction, state));

    collector.on('end', (_collected, reason) => endCommand(commandInteraction, reason));
  },
};

const endCommand = async (commandInteraction, reason) => {
  switch (reason) {
    case NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME:
      console.log(`Command cancelled, no members left to manage`);

      await commandInteraction.reply({
        content: `It looks like I have no members that I am allowed to remove roles from 🤷‍♂️ Remember to drag my role above the roles in the server you want me to be able to remove.`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    case NO_ROLES_TO_REMOVE_EVENT_NAME:
      console.log(`Command cancelled, bot has no roles it can manage`);

      await commandInteraction.reply({
        content: `It looks like I have no roles that I can manage 🤷‍♂️ Remember to drag my role above the roles in the server you want me to be able to remove.`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    case CANCELLED_BY_USER_EVENT_NAME:
      console.log(`Command cancelled by user`);

      await commandInteraction.deleteReply();
      await commandInteraction.followUp({
        content: `Command cancelled by you 🛑`,
        components: [],
        flags: MessageFlags.Ephemeral,
      });
      break;
    default:
      console.log(`Command timed out (${INTERACTION_RESPONSE_TIMEOUT_MS / 60000} min)`);

      await commandInteraction.deleteReply();
      await commandInteraction.followUp({
        content: `⌛ I didn't get a response within ${INTERACTION_RESPONSE_TIMEOUT_MS / 60000} minutes minutes, bye! 👋`,
        components: [],
        flags: MessageFlags.Ephemeral,
      });
      break;
  }
};

const collectorOnCollect = async (collector, componentInteraction, state) => {
  switch (componentInteraction.customId) {
    case STRING_SELECT_MENU_COMPONENT_ID:
      await onRoleSelectBlur(componentInteraction, state);
      break;
    case CONFIRM_BUTTON_COMPONENT_ID:
      await onConfirmBtnClick(
        componentInteraction,
        state.guildMemberCollection,
        state.availableRolesCollection,
        state.selectedRoleIds
      );
      break;
    case CANCEL_BUTTON_COMPONENT_ID:
      collector.stop(CANCELLED_BY_USER_EVENT_NAME);
      break;
    default:
      console.error(`Unhandled component interaction with id "${componentInteraction.customId}"`);
      break;
  }
};

const onRoleSelectBlur = async (componentInteraction, state) => {
  state.selectedRoleIds = componentInteraction.values;

  await componentInteraction.deferUpdate();
  await componentInteraction.message.edit({
    components: [
      getStringSelectActionRow(state.availableRolesCollection, state.selectedRoleIds),
      getButtonsActionRow(state.selectedRoleIds.length === 0),
    ],
  });
};

const onConfirmBtnClick = async (componentInteraction, guildMemberCollection, roleCollection, selectedRoleIds) => {
  const roleCollectionRemovedManagedRoles = roleCollection.filter((role) => !role.managed);
  selectedRoleIds = selectedRoleIds.filter((roleId) => roleCollectionRemovedManagedRoles.get(roleId));
  const selectedRoleNames = selectedRoleIds.map((roleId) => roleCollectionRemovedManagedRoles.get(roleId)?.name);
  const selectedRoleNamesStr = selectedRoleNames.map((r) => `*${r}*`).joinReplaceLast(', ', 'and');

  const replyText = await removeRolesFromAllMembers(guildMemberCollection, selectedRoleIds, selectedRoleNamesStr);

  await componentInteraction.update({ content: replyText, components: [] });
};

const getButtonsActionRow = (shouldDisableCfmBtn) => {
  return new ActionRowBuilder().setComponents(
    new ButtonBuilder().setCustomId(CANCEL_BUTTON_COMPONENT_ID).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CONFIRM_BUTTON_COMPONENT_ID)
      .setLabel('Remove roles')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(shouldDisableCfmBtn)
  );
};

const getStringSelectActionRow = (roleCollection, selectedRoleIds) => {
  return new ActionRowBuilder().setComponents(getStringSelectMenuBuilder(roleCollection, selectedRoleIds));
};

const getStringSelectMenuBuilder = (roleCollection, selectedRoleIds) => {
  return new StringSelectMenuBuilder()
    .setCustomId(STRING_SELECT_MENU_COMPONENT_ID)
    .setPlaceholder('Select roles to remove from members')
    .setMinValues(1) // So we can disable the cfm button, but we really want atleast 1
    .setMaxValues(roleCollection.size)
    .setOptions(
      roleCollection.map((role) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(role.name)
          .setValue(role.id)
          // Will keep already selected values on blur
          .setDefault(selectedRoleIds.includes(role.id))
      )
    );
};

const filterGuildMembers = (guildMemberCollection, commandCallerUserId) => {
  let filteredMemberNamesAndReason = [];

  const filteredMemberCollection = guildMemberCollection.filter((member) => {
    // We do not touch the member who is using the command
    if (member.user.id === commandCallerUserId) {
      filteredMemberNamesAndReason.push({ displayName: member.displayName, reason: 'Command caller' });
      return false;
    }

    // Bots cannot remove other bots' roles
    if (member.user.bot) {
      filteredMemberNamesAndReason.push({ displayName: member.displayName, reason: 'Bot' });
      return false;
    }

    if (!member.moderatable) {
      filteredMemberNamesAndReason.push({ displayName: member.displayName, reason: 'Not moderatable' });
      return false;
    }

    return true;
  });

  console.log(`========= Members removed by filter =========`);
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

  console.log(`========= Roles removed by filter =========`);
  console.table(filteredRoleNamesAndReason);

  return filteredAndSortedRoleCollection;
};

const removeRolesFromAllMembers = async (guildMemberCollection, selectedRoleIds, selectedRoleNamesStr) => {
  let membersRolesRemovalResults = [];

  for (const member of guildMemberCollection.values()) {
    try {
      membersRolesRemovalResults.push({ displayName: member.displayName, result: 'Success' });
      await member.roles.remove(selectedRoleIds);
    } catch (error) {
      membersRolesRemovalResults.push({ displayName: member.displayName, result: 'Failure' });
      console.log(`ERROR when removing ${member.displayName} roles`, error);
    }
  }

  console.log(`========= Member roles removal results =========`);
  console.table(membersRolesRemovalResults);

  const removedRolesText = `Yeeted ${selectedRoleIds.length > 1 ? 'roles' : 'role'} ${selectedRoleNamesStr} from ${membersRolesRemovalResults.length} unsuspecting ${membersRolesRemovalResults.length > 1 ? 'souls' : 'soul'} ✅`;
  const noRolesRemovedText = `I didn't manage to remove any roles from anyone 🤷‍♂️`;

  return membersRolesRemovalResults.length === 0 ? noRolesRemovedText : removedRolesText;
};
