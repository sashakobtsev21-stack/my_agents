# RuVector PostgreSQL Testing Environment

A Docker-based testing environment for the **RuVector PostgreSQL extension** from [ruvnet/ruvector](https://github.com/ruvnet/ruvector).

> **Note**: This uses the official RuVector PostgreSQL extension, not pgvector. RuVector provides 77+ SQL functions with advanced AI capabilities.

## RuVector Features

| Feature | Description |
|---------|-------------|
| **77+ SQL Functions** | Comprehensive vector operations in SQL |
| **HNSW/IVFFlat Indexing** | ~61µs search latency, 16,400 QPS |
| **39 Attention Mechanisms** | Self, multi-head, cross-attention in SQL |
| **GNN Operations** | Graph neural network layers (GAT, message passing) |
| **Hyperbolic Embeddings** | Poincaré and Lorentz space implementations |
| **Sparse Vectors** | BM25/TF-IDF for hybrid search |
| **SPARQL Support** | 50+ RDF functions (W3C SPARQL 1.1) |
| **Local Embeddings** | 6 fastembed models for offline generation |
| **Self-Learning Indices** | Continuous optimization through GNN layers |
| **SIMD Acceleration** | AVX-512/AVX2/NEON (~2x faster) |

## Quick Start

### 1. Start the RuVector PostgreSQL container

```bash
# From this directory
docker-compose up -d

# Or from the project root
docker-compose -f docs/ruvector-postgres/docker-compose.yml up -d
```

### 2. Verify the container is running

```bash
docker-compose ps
```

You should see:
```
NAME                STATUS              PORTS
ruvector-postgres   running (healthy)   0.0.0.0:5432->5432/tcp
```

### 3. Test the connection

```bash
# Using psql
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c "SELECT ruvector.version();"

# Or run our test script
./scripts/test-connection.sh
```

### 4. Initialize RuVector CLI

```bash
# Run from project root
npx claude-flow@alpha ruvector status \
  --host localhost \
  --port 5432 \
  --database claude_flow \
  --user claude
```

When prompted for password, enter: `claude-flow-test`

## Directory Structure

```
docs/ruvector-postgres/
├── README.md                 # This file
├── docker-compose.yml        # Docker services configuration
├── scripts/
│   ├── init-db.sql          # Database initialization (runs on container start)
│   ├── test-connection.sh   # Connection test script
│   ├── run-migrations.sh    # Run RuVector migrations
│   └── cleanup.sh           # Remove all data and reset
├── examples/
│   ├── basic-queries.sql    # Basic vector operations
│   ├── similarity-search.sql # HNSW semantic search examples
│   ├── attention-ops.sql    # Attention mechanism examples
│   └── v3-demo.sql          # Complete V3 demo with all features
└── tests/
    ├── test-vectors.ts      # TypeScript test suite
    └── benchmark.sh         # Performance benchmarks
```

## Connection Details

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `claude_flow` |
| Username | `claude` |
| Password | `claude-flow-test` |
| Schema | `claude_flow` |

## Available Services

### RuVector PostgreSQL

- **Container**: `ruvector-postgres`
- **Image**: `ruvector/postgres:latest`
- **Port**: 5432

Pre-configured with:
- RuVector extension enabled (77+ functions)
- `claude_flow` schema created
- Core tables (embeddings, patterns, agents, trajectories, hyperbolic_embeddings, graph_nodes, graph_edges)
- HNSW indices for fast similarity search (~61µs)
- Sample test data
- Self-learning optimization enabled

### pgAdmin (Optional)

For visual database management:

```bash
# Start with pgAdmin
docker-compose --profile gui up -d
```

Access at: http://localhost:5050
- Email: `admin@claude-flow.local`
- Password: `admin`

## Common Tasks

### Generate embeddings locally

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT claude_flow.embed_text('Hello, world!', 'all-MiniLM-L6-v2');"
```

### Run similarity search

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT * FROM claude_flow.search_similar(
    claude_flow.embed_text('authentication security'),
    5,
    0.3
  );"
```

### Run multi-head attention

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT * FROM claude_flow.multihead_attention(
    claude_flow.embed_text('query text'),
    8,  -- number of heads
    5   -- limit
  );"
```

### Hyperbolic search (for hierarchical data)

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT * FROM claude_flow.hyperbolic_search(
    claude_flow.embed_text('parent concept'),
    10,
    -1.0  -- curvature
  );"
```

### Check HNSW indices

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'claude_flow';"
```

### Run self-learning optimization

```bash
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "SELECT claude_flow.optimize_indices();"
```

### Reset everything

```bash
./scripts/cleanup.sh
docker-compose down -v
docker-compose up -d
```

## Testing with Claude-Flow CLI

### Check status

```bash
npx claude-flow@alpha ruvector status \
  --host localhost \
  --database claude_flow \
  --user claude \
  --verbose
```

### Run migrations

```bash
npx claude-flow@alpha ruvector migrate \
  --host localhost \
  --database claude_flow \
  --user claude \
  --up
```

### Run benchmarks

```bash
npx claude-flow@alpha ruvector benchmark \
  --host localhost \
  --database claude_flow \
  --user claude \
  --iterations 100
```

### Optimize indices

```bash
npx claude-flow@alpha ruvector optimize \
  --host localhost \
  --database claude_flow \
  --user claude \
  --analyze
```

## Environment Variables

You can use environment variables instead of CLI flags:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=claude_flow
export PGUSER=claude
export PGPASSWORD=claude-flow-test

# RuVector specific
export RUVECTOR_SIMD=auto
export RUVECTOR_CACHE_SIZE=256MB
export RUVECTOR_LEARN_ENABLED=true

# Then run without connection flags
npx claude-flow@alpha ruvector status --verbose
```

## RuVector SQL Functions Reference

### Vector Operations
| Function | Description |
|----------|-------------|
| `ruvector.cosine_similarity(a, b)` | Cosine similarity between vectors |
| `ruvector.euclidean_distance(a, b)` | L2 distance |
| `ruvector.dot_product(a, b)` | Inner product |
| `a <-> b` | Distance operator (uses index) |
| `a <=> b` | Cosine distance operator |

### Attention Mechanisms
| Function | Description |
|----------|-------------|
| `ruvector.softmax_attention(q, k, temp)` | Softmax attention score |
| `ruvector.multihead_attention_scores(q, k, heads)` | Per-head attention scores |
| `ruvector.multihead_attention_aggregate(q, k, heads)` | Aggregated attention |
| `ruvector.cross_attention_score(q, kv, temp)` | Cross-attention weight |

### GNN Operations
| Function | Description |
|----------|-------------|
| `ruvector.gnn_aggregate(embeddings[], method)` | Aggregate embeddings (mean/sum/max) |
| `ruvector.gat_score(source, target)` | Graph attention score |

### Hyperbolic Operations
| Function | Description |
|----------|-------------|
| `ruvector.exp_map_poincare(euclidean, curvature)` | Map to Poincaré ball |
| `ruvector.hyperbolic_distance(a, b, model, curvature)` | Geodesic distance |
| `ruvector.mobius_add(a, b, curvature)` | Möbius addition |

### Sparse/Hybrid Search
| Function | Description |
|----------|-------------|
| `ruvector.bm25_score(sparse, query_text)` | BM25 ranking score |
| `ruvector.tfidf_score(sparse, query_text)` | TF-IDF score |

### Local Embeddings
| Function | Description |
|----------|-------------|
| `ruvector.fastembed(text, model)` | Generate embedding locally |

### Self-Learning
| Function | Description |
|----------|-------------|
| `ruvector.learn_optimize(table, column)` | Optimize index through learning |

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| HNSW Search Latency | ~61µs (k=10, 384-dim) |
| Throughput | 16,400 QPS |
| Memory (1M vectors) | 200MB (PQ8 compression) |
| Index Build | ~10 min for 1M vectors |

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs postgres

# Check if port 5432 is in use
lsof -i :5432
```

### RuVector extension missing

```bash
# Manually enable
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "CREATE EXTENSION IF NOT EXISTS ruvector;"
```

### Permission denied errors

```bash
# Reset permissions
docker exec -it ruvector-postgres psql -U claude -d claude_flow -c \
  "GRANT ALL ON SCHEMA claude_flow TO claude;
   GRANT USAGE ON SCHEMA ruvector TO claude;"
```

### Reset to clean state

```bash
docker-compose down -v
docker-compose up -d
```

## Learn More

- [RuVector Repository](https://github.com/ruvnet/ruvector)
- [RuVector PostgreSQL Bridge Documentation](https://github.com/ruvnet/claude-flow/issues/963)
- [ADR-027: RuVector PostgreSQL Integration](../../v3/implementation/adrs/ADR-027-ruvector-postgresql-integration.md)
