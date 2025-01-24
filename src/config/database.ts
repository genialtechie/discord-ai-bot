import { SupabaseDatabaseAdapter } from '@elizaos/adapter-supabase';
import { elizaLogger } from '@elizaos/core';
import { env } from './env.ts';

export const initializeDatabase = () => {
  if (!env.supabase.url || !env.supabase.key) {
    elizaLogger.error('Supabase URL or key is not set');
    throw new Error('Supabase URL or key is not set');
  }
  return new SupabaseDatabaseAdapter(env.supabase.url!, env.supabase.key!);
};
