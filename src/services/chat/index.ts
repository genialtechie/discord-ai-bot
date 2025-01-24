import { Character, elizaLogger, settings } from '@elizaos/core';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

async function handleUserInput(input: string, agentId: string) {
  if (input.toLowerCase() === 'exit') {
    rl.close();
    process.exit(0);
  }

  try {
    const serverPort = parseInt(process.env.PORT || '3000');
    const url = `http://localhost:${serverPort}/${agentId}/message`;
    elizaLogger.info('Sending request to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        userId: 'user',
        userName: 'User',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      elizaLogger.error(
        `Server responded with ${response.status}: ${errorText}`
      );
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
    }

    data.forEach((message: any) => console.log(`${'Agent'}: ${message.text}`));
  } catch (error) {
    console.error('Error details:', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startChat(character: Character) {
  function chat() {
    if (!character.id) {
      console.error('Character ID is required for chat');
      process.exit(1);
    }
    rl.question('You: ', async (input) => {
      await handleUserInput(input, character.id!);
      if (input.toLowerCase() !== 'exit') {
        chat(); // Loop back to ask another question
      }
    });
  }

  return chat;
}
