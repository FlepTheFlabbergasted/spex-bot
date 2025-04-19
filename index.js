import 'dotenv/config';

import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { handleCommands } from './handlers/commands.handler.js';
import { handleInteractions } from './handlers/interactions.handler.js';

initializeApp();
setGlobalOptions({ region: 'europe-west3' });

// To keep track of our active games
const activeGames = {};

const PUBLIC_KEY = process.env.PUBLIC_KEY;
console.log('PUBLIC_KEY: ', PUBLIC_KEY);

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
export const discord = onRequest(async (req, res) => {
  // Verify the interaction request using discord-interactions
  const isVerified = await verifyKey(
    req.rawBody,
    req.headers['x-signature-ed25519'],
    req.headers['x-signature-timestamp'],
    PUBLIC_KEY
  );

  if (!isVerified) {
    console.error('Invalid request signature');
    return res.status(400).send('Invalid request signature');
  }

  const { type } = req.body;

  switch (type) {
    case InteractionType.PING:
      return res.send({ type: InteractionResponseType.PONG });
    case InteractionType.APPLICATION_COMMAND:
      return handleCommands(req, res, activeGames);
    case InteractionType.MESSAGE_COMPONENT:
      return handleInteractions(req, res, activeGames);
    default:
      console.error(`unknown interaction type '${type}'`);
      return res.status(400).json({ error: `unknown interaction type '${type}'` });
  }
});
