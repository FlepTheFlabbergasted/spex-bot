import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import { DiscordRequest } from '../util/discord-request.js';
import { CHALLENGE_COMMAND } from './challenge.command.js';
import { TEST_COMMAND } from './test.command.js';

/**
 * To be run with package script `npm run register`
 */
export async function RegisterGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND];

console.log('APP_ID: ', process.env.APP_ID);

RegisterGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
