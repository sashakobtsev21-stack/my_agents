/**
 * Financial Risk MCP Tools
 *
 * High-performance financial risk analysis tools including:
 * - portfolio-risk: Calculate VaR, CVaR, Sharpe, and other risk metrics
 * - anomaly-detect: Detect anomalies in transactions using GNN
 * - market-regime: Classify current market regime using pattern matching
 * - compliance-check: Verify regulatory compliance (Basel III, MiFID II, etc.)
 * - stress-test: Run stress testing scenarios on portfolios
 */

import type { MCPTool } from './types.js';



// ============================================================================

// Auth/rate-limiting + the five handler implementations were extracted
// into ./mcp-tools-handlers.ts during campaign-2 wave 25 (W231).
import {
  anomalyDetectHandler,
  complianceCheckHandler,
  marketRegimeHandler,
  portfolioRiskHandler,
  stressTestHandler,
} from './mcp-tools-handlers.js';

export const portfolioRiskTool: MCPTool = {
  name: 'finance/portfolio-risk',
  description: 'Analyze portfolio risk using VaR, CVaR, Sharpe ratio, and stress testing. Supports historical and Monte Carlo simulation methods.',
  category: 'finance',
  version: '1.0.0',
  tags: ['portfolio', 'risk', 'var', 'cvar', 'sharpe', 'monte-carlo'],
  cacheable: false, // Financial data should not be cached
  cacheTTL: 0,
  inputSchema: {
    type: 'object',
    properties: {
      holdings: { type: 'array', description: 'Portfolio holdings with symbol, quantity, asset class' },
      riskMetrics: { type: 'array', description: 'Risk metrics to calculate' },
      confidenceLevel: { type: 'number', description: 'Confidence level for VaR (default: 0.95)' },
      horizon: { type: 'string', description: 'Time horizon for risk calculations' },
    },
    required: ['holdings'],
  },
  handler: portfolioRiskHandler,
};

// ============================================================================

export const anomalyDetectTool: MCPTool = {
  name: 'finance/anomaly-detect',
  description: 'Detect anomalies in transactions using GNN and sparse inference. Supports fraud, AML, and market manipulation contexts.',
  category: 'finance',
  version: '1.0.0',
  tags: ['anomaly', 'fraud', 'aml', 'detection', 'gnn', 'sparse'],
  cacheable: false,
  cacheTTL: 0,
  inputSchema: {
    type: 'object',
    properties: {
      transactions: { type: 'array', description: 'Transactions to analyze' },
      sensitivity: { type: 'number', description: 'Anomaly sensitivity threshold (0-1)' },
      context: { type: 'string', description: 'Detection context (fraud, aml, market_manipulation, all)' },
    },
    required: ['transactions'],
  },
  handler: anomalyDetectHandler,
};

// ============================================================================

export const marketRegimeTool: MCPTool = {
  name: 'finance/market-regime',
  description: 'Classify market regime using historical pattern matching. Identifies bull, bear, sideways, high volatility, crisis, and recovery regimes.',
  category: 'finance',
  version: '1.0.0',
  tags: ['market', 'regime', 'classification', 'pattern-matching', 'hnsw'],
  cacheable: true,
  cacheTTL: 60000, // 1 minute
  inputSchema: {
    type: 'object',
    properties: {
      marketData: { type: 'object', description: 'Market data (prices, volumes, volatility)' },
      lookbackPeriod: { type: 'number', description: 'Lookback period in trading days' },
      regimeTypes: { type: 'array', description: 'Regime types to consider' },
    },
    required: ['marketData'],
  },
  handler: marketRegimeHandler,
};

// ============================================================================

export const complianceCheckTool: MCPTool = {
  name: 'finance/compliance-check',
  description: 'Check transactions and positions against regulatory requirements including Basel III, MiFID II, Dodd-Frank, AML, and KYC.',
  category: 'finance',
  version: '1.0.0',
  tags: ['compliance', 'regulatory', 'basel3', 'mifid2', 'aml', 'kyc'],
  cacheable: false,
  cacheTTL: 0,
  inputSchema: {
    type: 'object',
    properties: {
      entity: { type: 'string', description: 'Entity identifier' },
      regulations: { type: 'array', description: 'Regulations to check against' },
      scope: { type: 'string', description: 'Scope of compliance check' },
      asOfDate: { type: 'string', description: 'As-of date for the check' },
    },
    required: ['entity', 'regulations'],
  },
  handler: complianceCheckHandler,
};

// ============================================================================

export const stressTestTool: MCPTool = {
  name: 'finance/stress-test',
  description: 'Run stress test scenarios using historical and hypothetical shocks. Calculates portfolio impact, VaR breaches, and capital requirements.',
  category: 'finance',
  version: '1.0.0',
  tags: ['stress-test', 'scenario', 'risk', 'capital', 'regulatory'],
  cacheable: false,
  cacheTTL: 0,
  inputSchema: {
    type: 'object',
    properties: {
      portfolio: { type: 'object', description: 'Portfolio holdings' },
      scenarios: { type: 'array', description: 'Stress test scenarios' },
      metrics: { type: 'array', description: 'Metrics to calculate' },
    },
    required: ['portfolio', 'scenarios'],
  },
  handler: stressTestHandler,
};

// ============================================================================

// Export All Tools
// ============================================================================

export const financialTools: MCPTool[] = [
  portfolioRiskTool,
  anomalyDetectTool,
  marketRegimeTool,
  complianceCheckTool,
  stressTestTool,
];

export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['finance/portfolio-risk', portfolioRiskHandler],
  ['finance/anomaly-detect', anomalyDetectHandler],
  ['finance/market-regime', marketRegimeHandler],
  ['finance/compliance-check', complianceCheckHandler],
  ['finance/stress-test', stressTestHandler],
]);

export function getTool(name: string): MCPTool | undefined {
  return financialTools.find(t => t.name === name);
}

export function getToolNames(): string[] {
  return financialTools.map(t => t.name);
}

export default financialTools;
