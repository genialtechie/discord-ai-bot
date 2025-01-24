import { Character, IAgentRuntime, elizaLogger, Clients } from '@elizaos/core';
import { DiscordClientInterface } from '@elizaos/client-discord';
import { env } from '../config/env.ts';

export async function initializeDiscordClient(
  character: Character,
  runtime: IAgentRuntime
): Promise<Record<string, any>> {
  const clients: Record<string, any> = {};
  const clientTypes = character.clients?.map((c) => c.toLowerCase()) || [];
  elizaLogger.log(
    'initializeDiscordClient',
    clientTypes,
    'for',
    character.name
  );

  if (clientTypes.includes(Clients.DISCORD)) {
    if (!env.discord.apiToken || !env.discord.applicationId) {
      elizaLogger.warn(
        'Discord credentials not found, skipping Discord initialization'
      );
    } else {
      try {
        const discordClient = await DiscordClientInterface.start(runtime);
        if (discordClient) {
          clients.discord = discordClient;
          elizaLogger.info('Discord client initialized successfully');
        }
      } catch (error) {
        elizaLogger.error('Failed to initialize Discord client:', error);
      }
    }
  }

  // Initialize plugin clients if any
  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          try {
            const startedClient = await client.start(runtime);
            const clientType = determineClientType(client);
            elizaLogger.debug(`Initializing client of type: ${clientType}`);
            clients[clientType] = startedClient;
          } catch (error) {
            elizaLogger.error(`Failed to initialize plugin client:`, error);
          }
        }
      }
    }
  }

  elizaLogger.log('Initialized client types:', Object.keys(clients));
  return clients;
}

function determineClientType(client: any): string {
  if ('type' in client) {
    return client.type;
  }

  const constructorName = client.constructor?.name;
  if (constructorName && !constructorName.includes('Object')) {
    return constructorName.toLowerCase().replace('client', '');
  }

  return `client_${Date.now()}`;
}
