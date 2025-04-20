import { SlashCommandBuilder } from 'discord.js';

export const COMMAND_PING = {
  name: 'ping',
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  execute: async (interaction) => {
    return await interaction.reply('Pong!');
  },
};
