import { challengeCommand } from '../commands/challenge.command';
import { testCommand } from '../commands/test.command';

/**
 * Handle slash command requests
 * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
 */
export function handleCommands(req, res) {
  const commandName = req.body.data.name;

  switch (commandName) {
    case 'test':
      return testCommand(req, res);
    case 'challenge':
      return challengeCommand(req, res);
    default:
      console.error(`unknown command: ${commandName}`);
      return res.status(400).json({ error: 'unknown command' });
  }
}
