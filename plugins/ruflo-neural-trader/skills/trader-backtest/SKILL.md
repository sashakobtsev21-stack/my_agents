---
name: trader-backtest
description: Run a historical backtest for a trading strategy with walk-forward validation and performance metrics
allowed-tools: Bash(npx *) mcp__claude-flow__memory_store mcp__claude-flow__memory_retrieve mcp__claude-flow__memory_search mcp__claude-flow__neural_train mcp__claude-flow__hooks_intelligence_trajectory-start mcp__claude-flow__hooks_intelligence_trajectory-step mcp__claude-flow__hooks_intelligence_trajectory-end mcp__claude-flow__agentdb_pattern-store Read
argument-hint: "<strategy-name> [--period 1Y]"
---
Run a historical backtest for a trading strategy.

Steps:
1. Load the strategy configuration:
   `mcp__claude-flow__memory_retrieve({ key: "strategy-STRATEGY_NAME", namespace: "trading-strategies" })`
   If not found, list available strategies:
   `mcp__claude-flow__memory_search({ query: "strategy", namespace: "trading-strategies", limit: 10 })`
2. Load historical OHLCV data for the specified period (default 1Y)
3. Start a learning trajectory:
   `mcp__claude-flow__hooks_intelligence_trajectory-start({ context: "backtest-STRATEGY_NAME-PERIOD" })`
4. Execute walk-forward backtest:
   - Split data into rolling train/test windows (e.g., 6-month train, 1-month test)
   - For each window: compute baseline Z-scores on train, apply strategy rules on test
   - Record each simulated trade as a trajectory step:
     `mcp__claude-flow__hooks_intelligence_trajectory-step({ action: "trade", details: "BUY/SELL at PRICE, result: +/-PNL" })`
5. Calculate aggregate performance metrics:
   - Total return, annualized return, Sharpe ratio, Sortino ratio
   - Max drawdown, average drawdown, recovery time
   - Win rate, profit factor, average win/loss ratio
   - Number of trades, average holding period
6. End trajectory with outcome:
   `mcp__claude-flow__hooks_intelligence_trajectory-end({ outcome: "success/failure", reward: SHARPE_RATIO })`
7. Store backtest results:
   `mcp__claude-flow__memory_store({ key: "backtest-STRATEGY-TIMESTAMP", value: "RESULTS_JSON", namespace: "trading-backtests" })`
8. If Sharpe > 1.5, store as a successful pattern:
   `mcp__claude-flow__agentdb_pattern-store({ pattern: "profitable-STRATEGY_TYPE", data: "STRATEGY_PARAMS_AND_RESULTS" })`
9. Train SONA on the backtest trajectory:
   `mcp__claude-flow__neural_train({ patternType: "trading-strategy", epochs: 10 })`
