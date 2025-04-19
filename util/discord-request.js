import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_ROOT_API_URL = 'https://discord.com/api/v10/';

export async function DiscordRequest(endpoint, options) {
  const url = DISCORD_ROOT_API_URL + endpoint;

  // Stringify payloads
  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'SpexBot (https://github.com/FlepTheFlabbergasted/spex-bot, 1.0.0)',
    },
    ...options,
  });

  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }

  // return original response
  return res;
}

export async function getUserRoles({ guildId, userId }) {
  const response = await DiscordRequest(`guilds/${guildId}/members/${userId}`, { method: 'GET' });
  const member = await response.json();

  // Array of role IDs
  return member.roles;
}

export async function getRoles({ guildId }) {
  const response = await DiscordRequest(`guilds/${guildId}/roles`, { method: 'GET' });
  const roles = await response.json();

  return roles;
}
