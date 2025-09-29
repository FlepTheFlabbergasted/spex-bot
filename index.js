import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import 'dotenv/config';
import { getCommandCollection } from './commands/util/get-command-collection.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});
client.commands = getCommandCollection();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(
      `\n=== User ${interaction.member.displayName} (${interaction.member.id}) called command ${interaction.commandName} ===`
    );
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const followUpOrReplyData = {
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    };

    return await (interaction.replied || interaction.deferred
      ? interaction.followUp(followUpOrReplyData)
      : interaction.reply(followUpOrReplyData));
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(DISCORD_TOKEN);
