import { AgentRuntime } from '@elizaos/core';

const start = async () => {
  try {
    console.log('Bot is ready!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
};

start();
