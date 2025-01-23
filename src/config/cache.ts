import {
  CacheManager,
  Character,
  DbCacheAdapter,
  IDatabaseCacheAdapter,
  elizaLogger,
} from '@elizaos/core';

export function initializeDbCache(
  character: Character,
  db: IDatabaseCacheAdapter
) {
  if (!character.id) {
    elizaLogger.error('Character ID is required');
    throw new Error('Character ID is required');
  }
  const cache = new CacheManager(new DbCacheAdapter(db, character.id));
  return cache;
}
