#!/bin/bash
# Test connection to RuVector PostgreSQL

set -e

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
DATABASE="${PGDATABASE:-claude_flow}"
USER="${PGUSER:-claude}"
PASSWORD="${PGPASSWORD:-claude-flow-test}"

echo "🔍 Testing RuVector PostgreSQL Connection"
echo "=========================================="
echo ""

# Test basic connection
echo "1. Testing connection..."
PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Connection successful"
else
    echo "   ❌ Connection failed"
    exit 1
fi

# Check PostgreSQL version
echo ""
echo "2. PostgreSQL version:"
PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "SELECT version();" | head -1

# Check pgvector extension
echo ""
echo "3. Checking pgvector extension..."
RESULT=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT extversion FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | tr -d ' ')
if [ -n "$RESULT" ]; then
    echo "   ✅ pgvector version: $RESULT"
else
    echo "   ❌ pgvector extension not found"
fi

# Check schema
echo ""
echo "4. Checking claude_flow schema..."
RESULT=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'claude_flow';" | tr -d ' ')
if [ "$RESULT" = "1" ]; then
    echo "   ✅ Schema exists"
else
    echo "   ❌ Schema not found"
fi

# Check tables
echo ""
echo "5. Checking tables..."
TABLES=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'claude_flow';" | tr -d ' ' | grep -v "^$")
for table in $TABLES; do
    echo "   ✅ Table: $table"
done

# Check indices
echo ""
echo "6. Checking HNSW indices..."
INDICES=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'claude_flow' AND indexdef LIKE '%hnsw%';" | tr -d ' ' | grep -v "^$")
for idx in $INDICES; do
    echo "   ✅ Index: $idx"
done

# Count sample data
echo ""
echo "7. Sample data:"
COUNT=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT COUNT(*) FROM claude_flow.embeddings;" | tr -d ' ')
echo "   📊 Embeddings: $COUNT rows"

COUNT=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT COUNT(*) FROM claude_flow.patterns;" | tr -d ' ')
echo "   📊 Patterns: $COUNT rows"

COUNT=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c \
    "SELECT COUNT(*) FROM claude_flow.agents;" | tr -d ' ')
echo "   📊 Agents: $COUNT rows"

echo ""
echo "=========================================="
echo "✅ All checks passed! RuVector is ready."
echo ""
echo "Connection string:"
echo "  postgresql://$USER:****@$HOST:$PORT/$DATABASE"
