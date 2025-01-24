import {
  AgentRuntime,
  elizaLogger,
  type CacheManager,
  stringToUuid,
  type Character,
  type IDatabaseAdapter,
} from '@elizaos/core';
import { initializeDatabase } from './config/database.ts';
import { initializeDbCache } from './config/cache.ts';
import { character } from './config/character.ts';
import { initializeDiscordClient } from './client/discord.ts';
import { createNodePlugin, type NodePlugin } from '@elizaos/plugin-node';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
import { getTokenForProvider } from './utils/util_functions.ts';
import { DirectClient } from '@elizaos/client-direct';
import net from 'net';
import { startChat } from './services/chat/index.ts';
let nodePlugin: NodePlugin;

const createAgent = async (
  character: Character,
  db: IDatabaseAdapter,
  cache: CacheManager,
  token: string
) => {
  elizaLogger.info('Creating agent for character', character.name);
  nodePlugin ??= createNodePlugin();
  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [bootstrapPlugin, nodePlugin],
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
  });
};

const startAgent = async (client: DirectClient) => {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const db = initializeDatabase();
    await db.init();
    elizaLogger.info('Database initialized');
    const cache = initializeDbCache(character, db);
    elizaLogger.info('Cache initialized');
    const runtime = await createAgent(character, db, cache, token);
    await runtime.initialize();
    elizaLogger.info('Agent initialized');

    // Initialize all clients
    try {
      const clients = await initializeDiscordClient(character, runtime);
      runtime.clients = clients;
      elizaLogger.info('Clients initialized:', Object.keys(clients));
    } catch (clientError) {
      elizaLogger.warn('Some clients failed to initialize:', clientError);
    }

    client.registerAgent(runtime);
    elizaLogger.debug('Started character', character.name);

    return runtime;
  } catch (error) {
    elizaLogger.error('Failed to start character:', character.name, error);
    process.exit(1);
  }
};

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startClient = async () => {
  const client = new DirectClient();
  let port = parseInt(process.env.PORT || '3000');
  let available = await checkPortAvailable(port);
  while (!available) {
    elizaLogger.error('Port is already in use, retrying ', port + 1);
    port++;
    available = await checkPortAvailable(port);
  }

  client.startAgent = async (character: Character) => {
    return startAgent(client);
  };

  client.start(port);

  if (port !== parseInt(process.env.PORT || '3000')) {
    elizaLogger.log(`Server started on alternate port ${port}`);
  }

  // Start the agent and wait for it to be ready
  const runtime = await startAgent(client);
  elizaLogger.info('Agent runtime started');

  const isDaemonProcess = process.env.DAEMON_PROCESS === 'true';
  if (!isDaemonProcess && runtime) {
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    const chat = startChat(character);
    chat();
  }
};

startClient().catch((error) => {
  elizaLogger.error('Unhandled error in startAgents:', error);
  process.exit(1);
});
