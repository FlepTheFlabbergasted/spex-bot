import { Collection } from 'discord.js';
import { ALL_COMMANDS } from '../index.js';

export function getCommandCollection() {
  const commandCollection = new Collection();

  for (const command of ALL_COMMANDS) {
    if ('data' in command && 'execute' in command) {
      commandCollection.set(command.data.name, command);
    } else {
      console.warning(`[WARNING] The command ${command.name} is missing a required "data" or "execute" property.`);
    }
  }

  return commandCollection;
}
