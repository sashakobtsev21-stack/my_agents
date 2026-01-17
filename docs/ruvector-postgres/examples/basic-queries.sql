-- RuVector PostgreSQL Basic Queries
-- Optimized for Claude-Flow V3
--
-- These queries demonstrate fundamental vector operations
-- with HNSW indexing for 150x-12,500x faster search

-- ============================================
-- 1. INSERT EMBEDDINGS WITH METADATA
-- ============================================

-- Insert a single embedding (384-dimensional for MiniLM)
INSERT INTO claude_flow.embeddings (content, embedding, metadata)
VALUES (
    'Implementing secure authentication with JWT tokens',
    array_fill(0.1, ARRAY[384])::vector,  -- Replace with actual embedding
    '{"category": "security", "language": "typescript", "agent": "coder-1"}'::jsonb
);

-- Batch insert for better performance (recommended for >100 embeddings)
INSERT INTO claude_flow.embeddings (content, embedding, metadata)
SELECT
    'Sample content ' || i,
    (SELECT array_agg(random())::vector(384) FROM generate_series(1, 384)),
    jsonb_build_object(
        'batch_id', 'batch-001',
        'index', i,
        'created_by', 'v3-memory-specialist'
    )
FROM generate_series(1, 100) AS i;


-- ============================================
-- 2. BASIC SIMILARITY SEARCH (Cosine Distance)
-- ============================================

-- Find top 10 similar embeddings using cosine distance
-- The <=> operator uses HNSW index for sub-millisecond search
SELECT
    id,
    content,
    1 - (embedding <=> $1::vector) AS similarity,
    metadata
FROM claude_flow.embeddings
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- With similarity threshold (only return matches > 0.7 similarity)
SELECT
    id,
    content,
    1 - (embedding <=> $1::vector) AS similarity,
    metadata
FROM claude_flow.embeddings
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> $1::vector) > 0.7
ORDER BY embedding <=> $1::vector
LIMIT 10;


-- ============================================
-- 3. PATTERN STORAGE AND RETRIEVAL
-- ============================================

-- Store a learned pattern from SONA
INSERT INTO claude_flow.patterns (name, description, embedding, pattern_type, confidence, metadata)
VALUES (
    'authentication-flow',
    'JWT-based authentication pattern with refresh tokens',
    array_fill(0.1, ARRAY[384])::vector,
    'code-pattern',
    0.92,
    '{
        "learned_from": ["session-001", "session-002"],
        "agent_type": "security-architect",
        "success_rate": 0.95,
        "contexts": ["api", "web", "mobile"]
    }'::jsonb
);

-- Search patterns by type and minimum confidence
SELECT
    id,
    name,
    description,
    confidence,
    pattern_type,
    1 - (embedding <=> $1::vector) AS similarity
FROM claude_flow.patterns
WHERE pattern_type = 'code-pattern'
  AND confidence >= 0.8
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 5;


-- ============================================
-- 4. AGENT MEMORY OPERATIONS
-- ============================================

-- Register an agent with initial memory state
INSERT INTO claude_flow.agents (agent_id, agent_type, state, memory_embedding)
VALUES (
    'coder-v3-001',
    'coder',
    '{
        "current_task": null,
        "completed_tasks": 0,
        "specializations": ["typescript", "react", "node"],
        "performance_score": 0.0
    }'::jsonb,
    array_fill(0.0, ARRAY[384])::vector
)
ON CONFLICT (agent_id) DO UPDATE SET
    state = EXCLUDED.state,
    last_active = NOW();

-- Update agent memory embedding after task completion
UPDATE claude_flow.agents
SET
    memory_embedding = $1::vector,
    state = state || '{"completed_tasks": 1}'::jsonb,
    last_active = NOW()
WHERE agent_id = 'coder-v3-001';

-- Find agents with similar memory (for knowledge transfer)
SELECT
    agent_id,
    agent_type,
    state,
    1 - (memory_embedding <=> $1::vector) AS memory_similarity,
    last_active
FROM claude_flow.agents
WHERE memory_embedding IS NOT NULL
  AND agent_id != 'coder-v3-001'
ORDER BY memory_embedding <=> $1::vector
LIMIT 3;


-- ============================================
-- 5. METADATA FILTERING WITH VECTOR SEARCH
-- ============================================

-- Combined metadata and vector search (V3 optimized)
SELECT
    id,
    content,
    1 - (embedding <=> $1::vector) AS similarity,
    metadata
FROM claude_flow.embeddings
WHERE embedding IS NOT NULL
  AND metadata->>'category' = 'security'
  AND (metadata->>'language')::text = ANY(ARRAY['typescript', 'javascript'])
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- JSONB path query with vector search
SELECT
    id,
    content,
    1 - (embedding <=> $1::vector) AS similarity,
    metadata
FROM claude_flow.embeddings
WHERE embedding IS NOT NULL
  AND metadata @> '{"agent": "coder-1"}'::jsonb
ORDER BY embedding <=> $1::vector
LIMIT 10;


-- ============================================
-- 6. AGGREGATIONS AND ANALYTICS
-- ============================================

-- Count embeddings by category
SELECT
    metadata->>'category' AS category,
    COUNT(*) AS count,
    AVG(1 - (embedding <=> (
        SELECT AVG(embedding) FROM claude_flow.embeddings
    ))) AS avg_centroid_similarity
FROM claude_flow.embeddings
WHERE metadata->>'category' IS NOT NULL
GROUP BY metadata->>'category'
ORDER BY count DESC;

-- Agent performance summary
SELECT
    agent_type,
    COUNT(*) AS agent_count,
    AVG((state->>'completed_tasks')::int) AS avg_completed_tasks,
    MAX(last_active) AS most_recent_activity
FROM claude_flow.agents
GROUP BY agent_type
ORDER BY agent_count DESC;


-- ============================================
-- 7. CLEANUP AND MAINTENANCE
-- ============================================

-- Delete old embeddings (keep last 30 days)
DELETE FROM claude_flow.embeddings
WHERE created_at < NOW() - INTERVAL '30 days';

-- Vacuum and analyze for optimal HNSW performance
VACUUM ANALYZE claude_flow.embeddings;
VACUUM ANALYZE claude_flow.patterns;
VACUUM ANALYZE claude_flow.agents;

-- Reindex HNSW for optimal search performance
REINDEX INDEX CONCURRENTLY claude_flow.idx_embeddings_hnsw;
