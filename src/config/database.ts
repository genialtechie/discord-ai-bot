import { SupabaseDatabaseAdapter } from '@elizaos/adapter-supabase';
import { env } from './env';

export const initializeDatabase = () => {
  return new SupabaseDatabaseAdapter(env.supabase.url, env.supabase.key);
};
