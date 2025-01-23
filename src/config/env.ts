import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

// Required environment variables
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'DISCORD_APPLICATION_ID',
  'OPENROUTER_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_KEY',
] as const;

// Validate environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const env = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
    applicationId: process.env.DISCORD_APPLICATION_ID!,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
    model:
      process.env.MODEL_NAME || 'sophosympatheia/rogue-rose-103b-v0.2:free',
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_KEY!,
  },
  coinApi: {
    key: process.env.COIN_API_KEY,
  },
} as const;
