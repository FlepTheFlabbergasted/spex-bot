import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { ALL_COMMANDS } from '../index.js';

const commandData = [];

for (const command of ALL_COMMANDS) {
  if ('data' in command && 'execute' in command) {
    commandData.push(command.data.toJSON());
  } else {
    console.warning(`[WARNING] The command ${command.name} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Started refreshing ${commandData.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
