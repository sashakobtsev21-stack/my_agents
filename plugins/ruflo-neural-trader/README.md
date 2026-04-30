# ruflo-neural-trader

Neural trading strategies -- time-series anomaly detection, backtesting, risk scoring, and portfolio optimization via SONA trajectories.

## Overview

Provides two specialized agents for strategy design and risk management. The trading strategist uses SONA trajectory learning and Z-score anomaly detection (reused from ruflo-iot-cognitum) to design, backtest, and optimize trading strategies. The risk analyst enforces position limits, calculates VaR/Sharpe/drawdown metrics, and manages circuit breakers.

## Installation

```bash
claude --plugin-dir plugins/ruflo-neural-trader
```

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `trading-strategist` | opus | Design neural strategies, detect price anomalies via Z-score, backtest with walk-forward validation, optimize via SONA |
| `risk-analyst` | sonnet | Portfolio risk assessment (VaR, Sharpe, drawdown), position sizing (Kelly, fixed fractional), circuit breakers |

## Skills

| Skill | Usage | Description |
|-------|-------|-------------|
| `trader-signal` | `/trader-signal [--strategy NAME]` | Generate trading signals via Z-score anomaly detection |
| `trader-backtest` | `/trader-backtest <strategy-name> [--period 1Y]` | Run historical backtest with walk-forward validation |
| `trader-portfolio` | `/trader-portfolio [--risk-target NUMBER]` | Optimize portfolio allocation with mean-variance optimization |

## Commands (8 subcommands)

```bash
# Strategy
trader strategy create <name>
trader backtest <strategy> --data <source>

# Signals
trader signal scan
trader signal scan --strategy <name>

# Risk & portfolio
trader risk assess <portfolio>
trader portfolio optimize [--risk-target N]

# History
trader history
```

## Strategy Types

| Strategy | Entry Signal | Best Regime |
|----------|-------------|-------------|
| Mean-reversion | Z-score > 2.0 (spike) | Ranging / oscillation |
| Momentum | Sustained drift anomaly | Trending |
| Statistical arbitrage | Spread Z-score > 2.0 | Any (market-neutral) |
| Pattern recognition | Cluster-outlier + match | Regime transitions |

## Circuit Breakers

| Breaker | Trigger | Action |
|---------|---------|--------|
| Daily loss | Drawdown > 3%/day | Halt new entries |
| Weekly loss | Drawdown > 5%/week | Reduce sizes 50% |
| Correlation spike | Portfolio corr > 0.85 | Reduce correlated positions |
| Volatility regime | VIX > 2x historical | Minimum position sizes |

## Related Plugins

- `ruflo-market-data` -- OHLCV data ingestion and candlestick pattern detection
- `ruflo-ruvector` -- HNSW indexing for strategy pattern similarity search
- `ruflo-cost-tracker` -- PnL tracking and cost attribution
- `ruflo-observability` -- Strategy performance dashboards

## License

MIT
