---
name: trader
description: Neural trading strategy development, backtesting, signal generation, risk assessment, and portfolio optimization
---
$ARGUMENTS
Manage neural trading strategies. Parse subcommand from $ARGUMENTS.

Usage: /trader <subcommand> [options]

Subcommands:
- `strategy create <name>` -- Create a new trading strategy with neural parameter optimization
- `backtest <strategy> --data <source>` -- Run historical backtest with walk-forward validation
- `signal scan` -- Scan for current trading signals using anomaly detection
- `signal scan --strategy <name>` -- Scan using a specific strategy's filters
- `risk assess <portfolio>` -- Calculate portfolio risk metrics (VaR, Sharpe, drawdown)
- `portfolio optimize` -- Optimize portfolio allocation via mean-variance optimization
- `portfolio optimize --risk-target <number>` -- Optimize with a specific risk target
- `history` -- View trade history and performance summary

Steps by subcommand:

**strategy create**:
1. Prompt for strategy type: mean-reversion, momentum, statistical-arbitrage, pattern-recognition
2. Configure parameters: lookback period, entry/exit thresholds, position sizing method
3. Configure anomaly detection: Z-score thresholds per anomaly type (spike, drift, flatline, oscillation)
4. Store strategy config:
   `mcp__claude-flow__memory_store({ key: "strategy-NAME", value: "CONFIG_JSON", namespace: "trading-strategies" })`
5. Train initial SONA patterns:
   `mcp__claude-flow__neural_train({ patternType: "trading-strategy", epochs: 10 })`

**backtest**:
1. Load strategy config:
   `mcp__claude-flow__memory_retrieve({ key: "strategy-NAME", namespace: "trading-strategies" })`
2. Load or generate historical data from specified source
3. Run walk-forward backtest: split into train/test windows, apply strategy rules
4. Calculate performance: total return, Sharpe ratio, max drawdown, win rate, profit factor
5. Record trajectory:
   `mcp__claude-flow__hooks_intelligence_trajectory-start({ context: "backtest-STRATEGY" })`
   Record each trade as a trajectory step, end with PnL outcome
6. Store results:
   `mcp__claude-flow__memory_store({ key: "backtest-ID", value: "RESULTS_JSON", namespace: "trading-backtests" })`

**signal scan**:
1. Fetch recent market data (OHLCV)
2. Compute Z-scores per dimension (open, high, low, close, volume) against rolling baseline
3. Classify anomalies: spike, drift, flatline, oscillation, pattern-break, cluster-outlier
4. Apply strategy filters if --strategy specified:
   `mcp__claude-flow__memory_retrieve({ key: "strategy-NAME", namespace: "trading-strategies" })`
5. Rank signals by anomaly score and confidence
6. Store signals:
   `mcp__claude-flow__memory_store({ key: "signal-TIMESTAMP", value: "SIGNALS_JSON", namespace: "trading-signals" })`
7. Use SONA prediction for regime context:
   `mcp__claude-flow__neural_predict({ input: "current anomaly pattern description" })`

**risk assess**:
1. Load portfolio holdings and current positions
2. Calculate: VaR (95%), CVaR, Sharpe ratio, Sortino ratio, max drawdown, Calmar ratio
3. Compute pairwise correlation matrix, flag pairs > 0.8
4. Evaluate circuit breaker conditions (daily/weekly loss, correlation spike, volatility regime)
5. Store assessment:
   `mcp__claude-flow__memory_store({ key: "risk-PORTFOLIO", value: "METRICS_JSON", namespace: "trading-risk" })`

**portfolio optimize**:
1. Load current holdings and historical returns
2. Compute expected returns and covariance matrix
3. Run mean-variance optimization (Markowitz efficient frontier)
4. Apply risk constraints: max position 10%, max correlation 0.8, max drawdown 15%
5. If --risk-target specified, find allocation on efficient frontier matching target volatility
6. Generate rebalancing plan: trades needed to reach optimal allocation
7. Store optimized allocation:
   `mcp__claude-flow__memory_store({ key: "portfolio-optimal-TIMESTAMP", value: "ALLOCATION_JSON", namespace: "trading-portfolio" })`

**history**:
1. Search trade history:
   `mcp__claude-flow__memory_search({ query: "trade history", namespace: "trading-history" })`
2. Aggregate by strategy: total PnL, win rate, average hold time, profit factor
3. Show recent trades with entry/exit prices, PnL, and strategy attribution
4. Compare strategy performance over time
