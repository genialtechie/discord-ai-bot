import { ModelProviderName } from '@elizaos/core';
import { type Character } from '@elizaos/core';

export const getTokenForProvider = (
  provider: ModelProviderName,
  character: Character
): string => {
  const token =
    character.settings?.secrets?.[`${provider.toUpperCase()}_API_KEY`];
  if (!token) throw new Error(`Missing API key for provider ${provider}`);
  return token;
};
