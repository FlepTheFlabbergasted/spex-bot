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

// Event names
const NO_ROLES_LEFT_TO_MANAGE_EVENT_NAME = 'noRolesLeftToManage';
const NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME = 'noMembersLeftToManage';
const CANCELLED_BY_USER_EVENT_NAME = 'cancelledByUser';
const ROLE_REMOVAL_SUCCESS_EVENT_NAME = 'roleRemovalSuccess';
const ROLE_REMOVAL_NO_MEMBERS_WITH_ROLES_EVENT_NAME = 'roleRemovalNoMembersWithRoles';
const ROLE_REMOVAL_FAILURE_EVENT_NAME = 'roleRemovalFailure';

// Role removal result names
const ROLE_REMOVAL_SUCCESSFUL_RESULT = 'Success';
const ROLE_REMOVAL_NO_MATCHING_ROLES_RESULT = 'No matching roles';
const ROLE_REMOVAL_FAILURE_RESULT = 'Failure';

// Component IDs
const STRING_SELECT_MENU_COMPONENT_ID = 'stringSelectMenuId';
const CANCEL_BUTTON_COMPONENT_ID = 'cancelButtonId';
const CONFIRM_BUTTON_COMPONENT_ID = 'confirmButtonId';
const PREV_PAGE_BUTTON_ID = 'prevPage';
const NEXT_PAGE_BUTTON_ID = 'nextPage';

// Settings
const MAX_ROLES_PER_PAGE = 25;
const INTERACTION_RESPONSE_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Remember to drag the bot role above all others you intend to remove
 * https://dev.to/terabytetiger/how-roles-cause-missing-permission-errors-in-discordjs-1ji7
 *
 * Keepalive
 * https://pm2.keymetrics.io/docs/usage/quick-start/
 *
 * Reminder to self:
 * Start with pm2 to keepalive
 * To update, run locally, shut of other instances
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
      selectedRoleIdsByPage: [[]],
      guildMemberCollection: filterGuildMembers(
        await commandInteraction.guild.members.fetch(),
        commandInteraction.user.id
      ),
      availableRolesCollection: filterAndSortGuildRoles(await commandInteraction.guild.roles.fetch()),
      totalRoleSelectPages: 0,
      currentRoleSelectPage: 0,
      membersRolesRemovalRows: [],
    };

    state.totalRoleSelectPages = Math.ceil(state.availableRolesCollection.size / MAX_ROLES_PER_PAGE);

    if (state.availableRolesCollection.size === 0) {
      await endCommand(commandInteraction, state, NO_ROLES_LEFT_TO_MANAGE_EVENT_NAME);
      return;
    } else if (state.guildMemberCollection.size === 0) {
      await endCommand(commandInteraction, state, NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME);
      return;
    }

    const interactionReply = await commandInteraction.reply({
      components: getPaginatedComponentsArr(state),
      flags: MessageFlags.Ephemeral,
    });

    const collector = interactionReply.createMessageComponentCollector({
      // Only listen to the user that called the command
      filter: (i) => i.user.id === commandInteraction.user.id,
      // Keep collection response open this long
      time: INTERACTION_RESPONSE_TIMEOUT_MS,
    });

    collector.on('collect', async (componentInteraction) => collectorOnCollect(collector, componentInteraction, state));
    collector.on('end', (_collected, reason) => endCommand(commandInteraction, state, reason));
  },
};

const collectorOnCollect = async (collector, componentInteraction, state) => {
  switch (componentInteraction.customId) {
    // When the user clicks away from the select menu after having clicked it (blur)
    case STRING_SELECT_MENU_COMPONENT_ID: {
      state.selectedRoleIdsByPage[state.currentRoleSelectPage] = componentInteraction.values;

      await componentInteraction.update({
        content: getCurrentRoleSelectionText(state),
        components: getPaginatedComponentsArr(state),
      });
      break;
    }
    case CONFIRM_BUTTON_COMPONENT_ID: {
      await removeRolesFromAllMembers(state);
      const successfulRoleRemovalRows = state.membersRolesRemovalRows.filter(
        (row) => row.result === ROLE_REMOVAL_SUCCESSFUL_RESULT
      );
      const noMatchingRolesRoleRemovalRows = state.membersRolesRemovalRows.filter(
        (row) => row.result === ROLE_REMOVAL_NO_MATCHING_ROLES_RESULT
      );

      if (successfulRoleRemovalRows.length) {
        collector.stop(ROLE_REMOVAL_SUCCESS_EVENT_NAME);
      } else if (noMatchingRolesRoleRemovalRows.length === state.membersRolesRemovalRows.length) {
        collector.stop(ROLE_REMOVAL_NO_MEMBERS_WITH_ROLES_EVENT_NAME);
      } else {
        collector.stop(ROLE_REMOVAL_FAILURE_EVENT_NAME);
      }

      break;
    }
    case CANCEL_BUTTON_COMPONENT_ID:
      collector.stop(CANCELLED_BY_USER_EVENT_NAME);
      break;
    case PREV_PAGE_BUTTON_ID:
      state.currentRoleSelectPage = Math.max(0, state.currentRoleSelectPage - 1);
      await componentInteraction.update({
        content: getCurrentRoleSelectionText(state),
        components: getPaginatedComponentsArr(state),
      });
      break;
    case NEXT_PAGE_BUTTON_ID:
      state.currentRoleSelectPage = state.currentRoleSelectPage + 1;
      await componentInteraction.update({
        content: getCurrentRoleSelectionText(state),
        components: getPaginatedComponentsArr(state),
      });
      break;
    default:
      console.error(`Unhandled component interaction with id "${componentInteraction.customId}"`);
      break;
  }
};

const getPaginatedComponentsArr = (state) => {
  const roleArray = Array.from(state.availableRolesCollection.values());

  const start = state.currentRoleSelectPage * MAX_ROLES_PER_PAGE;
  const end = start + MAX_ROLES_PER_PAGE;
  const pageRoles = roleArray.slice(start, end);

  return [
    getStringSelectActionRow(pageRoles, getSelectedRoleIds(state.selectedRoleIdsByPage)),
    getButtonsActionRow(state),
  ];
};

const getCurrentRoleSelectionText = (state) => {
  const selectedRoleIds = getSelectedRoleIds(state.selectedRoleIdsByPage);
  const selectedRoleNamesStr = getSelectedRoleNames(state).join(', ');

  return selectedRoleIds.length > 0
    ? `### Selected roles (${selectedRoleIds.length}):\n${selectedRoleNamesStr}\n\u200B`
    : `No roles selected yet.`;
};

const getButtonsActionRow = (state) => {
  return new ActionRowBuilder().setComponents(
    new ButtonBuilder().setCustomId(CANCEL_BUTTON_COMPONENT_ID).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PREV_PAGE_BUTTON_ID)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.currentRoleSelectPage === 0),
    new ButtonBuilder()
      .setCustomId('currentTotalPageBtnId')
      .setLabel(`Page ${state.currentRoleSelectPage + 1}/${state.totalRoleSelectPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(NEXT_PAGE_BUTTON_ID)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.currentRoleSelectPage >= state.totalRoleSelectPages - 1),
    new ButtonBuilder()
      .setCustomId(CONFIRM_BUTTON_COMPONENT_ID)
      .setLabel('Remove roles')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(getSelectedRoleIds(state.selectedRoleIdsByPage).length === 0)
  );
};

const getStringSelectActionRow = (rolesArr, selectedRoleIds) => {
  return new ActionRowBuilder().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STRING_SELECT_MENU_COMPONENT_ID)
      .setPlaceholder('Select roles to remove from members')
      .setMinValues(0)
      .setMaxValues(rolesArr.length)
      .setOptions(
        rolesArr.map((role) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(role.name)
            .setValue(role.id)
            // Will keep already selected values on blur
            .setDefault(selectedRoleIds.includes(role.id))
        )
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
      filteredRoleNamesAndReason.push({ name: role.name, reason: 'Not allowed' });
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

const removeRolesFromAllMembers = async (state) => {
  const selectedRoleIds = getSelectedRoleIds(state.selectedRoleIdsByPage);

  for (const member of state.guildMemberCollection.values()) {
    try {
      if (member.roles.cache.some((role) => selectedRoleIds.includes(role.id))) {
        await member.roles.remove(selectedRoleIds);
        state.membersRolesRemovalRows.push({
          displayName: member.displayName,
          result: ROLE_REMOVAL_SUCCESSFUL_RESULT,
        });
      } else {
        state.membersRolesRemovalRows.push({
          displayName: member.displayName,
          result: ROLE_REMOVAL_NO_MATCHING_ROLES_RESULT,
        });
      }
    } catch (error) {
      state.membersRolesRemovalRows.push({
        displayName: member.displayName,
        result: ROLE_REMOVAL_FAILURE_RESULT,
        error,
      });
    }
  }

  console.log(`========= Member roles removal results =========`);
  console.table(state.membersRolesRemovalRows);
};

const getSelectedRoleIds = (selectedRoleIdsByPage) => {
  return selectedRoleIdsByPage.flatMap((id) => id);
};

const getSelectedRoleNames = (state) => {
  return getSelectedRoleIds(state.selectedRoleIdsByPage)
    .map((id) => state.availableRolesCollection.get(id)?.name)
    .filter(Boolean)
    .sort((roleNameA, roleNameB) => roleNameA.localeCompare(roleNameB));
};

const endCommand = async (commandInteraction, state, reason) => {
  const selectedRoleNames = getSelectedRoleNames(state);
  const selectedRoleNamesStr = selectedRoleNames.map((roleName) => `*${roleName}*`);
  const plural = selectedRoleNames.length > 1;
  const roleWord = plural ? 'roles' : 'role';
  const memberWord = plural ? 'members' : 'member';
  const successfulRoleRemovalRows = state.membersRolesRemovalRows.filter(
    (row) => row.result === ROLE_REMOVAL_SUCCESSFUL_RESULT
  );
  const reorderRolesReminderText = `Remember to drag my role above the roles in the server you want me to be able to remove from members.`;

  switch (reason) {
    case NO_MEMBERS_LEFT_TO_MANAGE_EVENT_NAME:
      console.log(`Command cancelled, no members left to manage`);

      await commandInteraction.reply({
        content: `It looks like I have no members that I am allowed to remove roles from 🤷‍♂️ ${reorderRolesReminderText}`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    case NO_ROLES_LEFT_TO_MANAGE_EVENT_NAME:
      console.log(`Command cancelled, bot has no roles it can manage`);

      await commandInteraction.reply({
        content: `It looks like I have no roles that I can manage 🤷‍♂️ ${reorderRolesReminderText}`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    case CANCELLED_BY_USER_EVENT_NAME:
      console.log(`Command cancelled by user`);

      await commandInteraction.editReply({
        content: `Command cancelled by you 🛑`,
        components: [],
      });
      break;
    case ROLE_REMOVAL_NO_MEMBERS_WITH_ROLES_EVENT_NAME:
      console.log(
        `Command completed ambiguously, no members had the selected roles: ${selectedRoleNamesStr.joinReplaceLast(', ', 'or')}`
      );

      await commandInteraction.editReply({
        content: `I didn't manage to remove the ${roleWord} ${selectedRoleNamesStr.joinReplaceLast(', ', 'and')} from anyone since no one currently has ${plural ? 'those' : 'that'} ${roleWord} 🤷‍♂️`,
        components: [],
      });
      break;
    case ROLE_REMOVAL_FAILURE_EVENT_NAME:
      console.log(`Command completed unsuccessfully, all role removals ended in failure`);

      await commandInteraction.editReply({
        content: `I didn't manage to remove the ${roleWord} ${selectedRoleNamesStr.joinReplaceLast(', ', 'and')} from anyone, every time I tried, something went wrong 💥 Contact your local free-range bot developer for more hopefully more information.`,
        components: [],
      });
      break;
    case ROLE_REMOVAL_SUCCESS_EVENT_NAME:
      console.log(
        `Command completed successfully, removed ${roleWord} ${selectedRoleNamesStr.joinReplaceLast(', ', 'and')} from ${successfulRoleRemovalRows.length} ${memberWord}`
      );
      await commandInteraction.editReply({
        content: `Removed ${roleWord} ${selectedRoleNamesStr} from ${successfulRoleRemovalRows.length} ${memberWord}! ✅`,
        components: [],
      });
      break;
    default:
      console.log(`Command timed out (${INTERACTION_RESPONSE_TIMEOUT_MS / 60000} min)`);

      await commandInteraction.editReply({
        content: `⌛ I didn't get a response within ${INTERACTION_RESPONSE_TIMEOUT_MS / 60000} minutes minutes, bye! 👋`,
        components: [],
      });
      break;
  }
};
