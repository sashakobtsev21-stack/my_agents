---
name: trader-signal
description: Generate trading signals by running Z-score anomaly detection on market data and ranking by confidence
allowed-tools: Bash(npx *) mcp__claude-flow__memory_store mcp__claude-flow__memory_retrieve mcp__claude-flow__memory_search mcp__claude-flow__neural_predict mcp__claude-flow__agentdb_pattern-search Read
argument-hint: "[--strategy NAME]"
---
Generate trading signals using anomaly detection and neural prediction.

Steps:
1. Fetch recent market data (OHLCV) for target instruments
2. Compute Z-scores per dimension (open, high, low, close, volume) against a rolling baseline window (default 50 bars)
3. Calculate composite anomaly score: `anomalyScore = min(1, meanZ / 3)`
4. Classify each anomaly:
   - **spike** (maxZ > 5): breakout or gap -- potential momentum entry or mean-reversion fade
   - **drift** (1-2 dims sustained high Z): trend forming -- trend-following signal
   - **flatline** (all near zero, low Z): consolidation -- prepare for breakout
   - **oscillation** (alternating high/low): range-bound -- mean-reversion at extremes
   - **pattern-break** (moderate Z, multiple dims): regime change -- close positions, reassess
   - **cluster-outlier** (>50% dims high Z): multi-factor dislocation -- arbitrage opportunity
5. If --strategy specified, load strategy filters:
   `mcp__claude-flow__memory_retrieve({ key: "strategy-NAME", namespace: "trading-strategies" })`
   Apply strategy-specific entry rules and thresholds to filter signals
6. Use SONA to predict current market regime:
   `mcp__claude-flow__neural_predict({ input: "anomaly types: [DETECTED_TYPES], scores: [SCORES]" })`
7. Search for similar historical patterns:
   `mcp__claude-flow__agentdb_pattern-search({ query: "ANOMALY_TYPE with score RANGE", namespace: "trading-signals" })`
8. Rank signals by: anomaly score * strategy alignment * historical pattern match confidence
9. Output ranked signal list with: instrument, direction (long/short), confidence, anomaly type, suggested entry/stop/target
10. Store generated signals:
    `mcp__claude-flow__memory_store({ key: "signal-TIMESTAMP", value: "RANKED_SIGNALS_JSON", namespace: "trading-signals" })`
