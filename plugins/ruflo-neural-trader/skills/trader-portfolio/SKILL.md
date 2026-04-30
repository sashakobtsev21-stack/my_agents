---
name: trader-portfolio
description: Optimize portfolio allocation using mean-variance optimization with risk constraints and generate a rebalancing plan
allowed-tools: Bash(npx *) mcp__claude-flow__memory_store mcp__claude-flow__memory_retrieve mcp__claude-flow__memory_search mcp__claude-flow__neural_predict mcp__claude-flow__agentdb_pattern-search Read
argument-hint: "[--risk-target NUMBER]"
---
Optimize portfolio allocation and generate a rebalancing plan.

Steps:
1. Load current portfolio holdings and positions:
   `mcp__claude-flow__memory_search({ query: "current portfolio holdings", namespace: "trading-portfolio" })`
2. Gather historical return series for each holding (minimum 1Y daily returns)
3. Calculate expected returns (mean historical or SONA-predicted):
   `mcp__claude-flow__neural_predict({ input: "expected returns for [HOLDINGS] given current regime" })`
4. Compute covariance matrix from historical returns
5. Compute pairwise correlation matrix; flag pairs with correlation > 0.8 as concentration risk
6. Run mean-variance optimization (Markowitz):
   - If --risk-target specified: find allocation on efficient frontier matching that target volatility
   - Otherwise: maximize Sharpe ratio (tangency portfolio)
   - Constraints: max 10% per position, min 1% per position, sum to 100%
7. Apply risk constraints:
   - Max drawdown budget: 15% (reduce allocation to volatile assets if projected drawdown exceeds limit)
   - Correlation limit: reduce weight of assets in clusters with mean correlation > 0.8
   - Sector concentration: max 30% in any single sector
8. Calculate portfolio-level risk metrics for the optimized allocation:
   - Expected return, expected volatility, Sharpe ratio
   - VaR (95%), max drawdown estimate, diversification ratio
9. Generate rebalancing plan:
   - List trades needed: instrument, current weight, target weight, shares to buy/sell
   - Estimate transaction costs and tax impact
   - Suggest execution schedule (immediate vs. phased)
10. Search for similar portfolio configurations in history:
    `mcp__claude-flow__agentdb_pattern-search({ query: "optimized portfolio allocation Sharpe > 1", namespace: "trading-portfolio" })`
11. Store optimized allocation:
    `mcp__claude-flow__memory_store({ key: "portfolio-optimal-TIMESTAMP", value: "ALLOCATION_AND_PLAN_JSON", namespace: "trading-portfolio" })`
