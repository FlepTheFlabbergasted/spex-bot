import { InteractionResponseType, InteractionType, verifyKeyMiddleware } from 'discord-interactions';
import 'dotenv/config';
import express from 'express';
import { handleCommands } from './handle-commands.js';
import { handleInteractions } from './handle-interactions.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type } = req.body;

  switch (type) {
    // Handle verification requests
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

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
