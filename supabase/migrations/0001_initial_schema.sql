-- Enable the pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    name TEXT,
    added_by TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    last_price DECIMAL,
    last_updated TIMESTAMPTZ,
    embedding vector(1536)
);

-- Document summaries table
CREATE TABLE IF NOT EXISTS document_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    added_by TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(1536)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    notification_frequency TEXT DEFAULT 'daily',
    preferred_currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON watchlist(symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_embedding ON watchlist USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_document_summaries_embedding ON document_summaries USING ivfflat (embedding vector_cosine_ops); 