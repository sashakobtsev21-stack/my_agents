-- RuVector PostgreSQL Initialization Script
-- This script runs automatically when the Docker container starts

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the claude_flow schema
CREATE SCHEMA IF NOT EXISTS claude_flow;

-- Grant permissions
GRANT ALL ON SCHEMA claude_flow TO claude;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS claude_flow.embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding vector(384),  -- Default dimension for MiniLM
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create patterns table for learned patterns
CREATE TABLE IF NOT EXISTS claude_flow.patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding vector(384),
    pattern_type VARCHAR(50),
    confidence FLOAT DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agents table for agent memory
CREATE TABLE IF NOT EXISTS claude_flow.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL UNIQUE,
    agent_type VARCHAR(50),
    state JSONB DEFAULT '{}',
    memory_embedding vector(384),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW indices for fast similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
ON claude_flow.embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_patterns_hnsw
ON claude_flow.patterns
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_agents_hnsw
ON claude_flow.agents
USING hnsw (memory_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create helper functions

-- Cosine similarity search function
CREATE OR REPLACE FUNCTION claude_flow.search_similar(
    query_embedding vector(384),
    limit_count INT DEFAULT 10,
    min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        1 - (e.embedding <=> query_embedding) AS similarity,
        e.metadata
    FROM claude_flow.embeddings e
    WHERE 1 - (e.embedding <=> query_embedding) >= min_similarity
    ORDER BY e.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO claude_flow.embeddings (content, metadata) VALUES
    ('How to implement authentication in Node.js', '{"category": "tutorial", "language": "javascript"}'),
    ('Best practices for REST API design', '{"category": "tutorial", "language": "general"}'),
    ('Understanding PostgreSQL indexing strategies', '{"category": "database", "language": "sql"}'),
    ('Introduction to vector databases and embeddings', '{"category": "ai", "language": "python"}'),
    ('Building scalable microservices architecture', '{"category": "architecture", "language": "general"}')
ON CONFLICT DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'RuVector PostgreSQL initialization complete!';
    RAISE NOTICE 'Schema: claude_flow';
    RAISE NOTICE 'Tables: embeddings, patterns, agents';
    RAISE NOTICE 'Indices: 3 HNSW indices created';
END $$;
