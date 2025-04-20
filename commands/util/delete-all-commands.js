import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const APP_ID = process.env.APP_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_DEV_ID = process.env.GUILD_DEV_ID; // Note, using dev guild id here, need to manually replace if other server

const rest = new REST().setToken(DISCORD_TOKEN);

// for guild-based commands
rest
  .put(Routes.applicationGuildCommands(APP_ID, GUILD_DEV_ID), { body: [] })
  .then(() => console.log('Successfully deleted all guild commands'))
  .catch(console.error);

// for global commands
rest
  .put(Routes.applicationCommands(APP_ID), { body: [] })
  .then(() => console.log('Successfully deleted all global commands'))
  .catch(console.error);
