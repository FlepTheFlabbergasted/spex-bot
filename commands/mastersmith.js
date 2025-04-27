import { SlashCommandBuilder } from 'discord.js';

const COMMAND_NAME = 'mästersmith';

export const COMMAND_MASTERSMITH = {
  name: COMMAND_NAME,
  data: new SlashCommandBuilder().setName(COMMAND_NAME).setDescription('Does the thing!'),
  execute: async (interaction) => {
    return await interaction.reply(`🦆 🦆\n💥 🔫 💥 🔫\n🔫 🔄 🔫 🔄`);
  },
};
