import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_COMMANDS } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const APP_ID = process.env.APP_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_DEV_ID = process.env.GUILD_DEV_ID;
const NODE_ENV = process.env.NODE_ENV;

const commandData = [];

for (const command of ALL_COMMANDS) {
  if ('data' in command && 'execute' in command) {
    commandData.push(command.data.toJSON());
  } else {
    console.warning(`[WARNING] The command ${command.name} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commandData.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      NODE_ENV === 'prod' ? Routes.applicationCommands(APP_ID) : Routes.applicationGuildCommands(APP_ID, GUILD_DEV_ID),
      { body: commandData }
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
