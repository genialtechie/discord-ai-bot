import { type SupabaseDatabaseAdapter } from '@elizaos/adapter-supabase';
import {
  CacheManager,
  Character,
  ICacheAdapter,
  elizaLogger,
} from '@elizaos/core';

class SupabaseCacheAdapter implements ICacheAdapter {
  constructor(private db: SupabaseDatabaseAdapter, private agentId: string) {}

  async get(key: string): Promise<string | undefined> {
    const { data } = await this.db.supabase
      .from('cache')
      .select('value')
      .eq('agent_id', this.agentId)
      .eq('key', key)
      .single();
    return data?.value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.supabase.from('cache').upsert(
      {
        agent_id: this.agentId,
        key,
        value,
      },
      { onConflict: 'agent_id,key' }
    );
  }

  async delete(key: string): Promise<void> {
    await this.db.supabase
      .from('cache')
      .delete()
      .eq('agent_id', this.agentId)
      .eq('key', key);
  }
}

export function initializeDbCache(
  character: Character,
  db: SupabaseDatabaseAdapter
) {
  if (!character.id) {
    elizaLogger.error('Character ID is required');
    throw new Error('Character ID is required');
  }
  return new CacheManager(new SupabaseCacheAdapter(db, character.id));
}
