import { InteractionResponseType, InteractionType, verifyKeyMiddleware } from 'discord-interactions';
import 'dotenv/config';
import express from 'express';
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { handleCommands } from '../src/handle-commands.js';
import { handleInteractions } from '../src/handle-interactions.js';

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

initializeApp();
setGlobalOptions({ region: 'europe-west3' });

// To keep track of our active games
const activeGames = {};

const app = express();

console.log('process.env.PUBLIC_KEY: ', process.env.PUBLIC_KEY);

// app.use(verifyKeyMiddleware(process.env.PUBLIC_KEY));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/', (req, res) => {
  const { type } = req.body;

  verifyKeyMiddleware(process.env.PUBLIC_KEY);

  switch (type) {
    case InteractionType.PING:
      return res.send({ type: InteractionResponseType.PONG });
    case InteractionType.APPLICATION_COMMAND:
      return handleCommands(req, res, activeGames);
    case InteractionType.MESSAGE_COMPONENT:
      return handleInteractions(req, res, activeGames);
    default:
      console.error('unknown interaction type', type);
      return res.status(400).json({ error: 'unknown interaction type' });
  }
});

export const discord = onRequest(app);
