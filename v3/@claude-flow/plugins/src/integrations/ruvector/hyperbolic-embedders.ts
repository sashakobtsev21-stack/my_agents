/**
 * RuVector Hyperbolic — use-case embedders
 *
 * HierarchyEmbedder, ASTEmbedder, and DependencyGraphEmbedder
 * (TreeNode/ASTNode shapes included).
 * Extracted verbatim from hyperbolic.ts (lines 1562-1859) during the
 * P3.44 god-file decomposition (W165). hyperbolic.ts stays the barrel.
 */

import { DEFAULT_CURVATURE, add, zeros } from './hyperbolic-internal.js';
import { HyperbolicSpace } from './hyperbolic-space.js';
import type { HyperbolicModel } from './types.js';

// ============================================================================
// Use Case Implementations
// ============================================================================

/**
 * HierarchyEmbedder embeds tree-structured data in hyperbolic space.
 *
 * Useful for:
 * - Taxonomies (biological, product categories)
 * - Organizational charts
 * - File system hierarchies
 * - Knowledge graphs with hierarchical relations
 */
export class HierarchyEmbedder {
  private readonly space: HyperbolicSpace;
  private readonly dimension: number;

  constructor(
    dimension: number,
    model: HyperbolicModel = 'poincare',
    curvature: number = DEFAULT_CURVATURE
  ) {
    this.dimension = dimension;
    this.space = new HyperbolicSpace(model, curvature);
  }

  /**
   * Embeds a tree structure into hyperbolic space.
   *
   * Root is placed at the origin, children are placed along geodesics.
   *
   * @param tree - Tree structure with id, children, and optional data
   * @param angularSpread - Angular spread for children (default: 2*PI)
   * @returns Map of node IDs to embeddings
   */
  embedTree<T extends { id: string; children?: T[]; data?: unknown }>(
    tree: T,
    angularSpread: number = 2 * Math.PI
  ): Map<string, number[]> {
    const embeddings = new Map<string, number[]>();
    this.embedNode(tree, zeros(this.dimension), 0, angularSpread, embeddings);
    return embeddings;
  }

  private embedNode<T extends { id: string; children?: T[]; data?: unknown }>(
    node: T,
    position: number[],
    depth: number,
    angularSpread: number,
    embeddings: Map<string, number[]>
  ): void {
    embeddings.set(node.id, position);

    if (!node.children || node.children.length === 0) {
      return;
    }

    const numChildren = node.children.length;
    const angleStep = angularSpread / numChildren;
    const startAngle = -angularSpread / 2 + angleStep / 2;

    // Distance to children decreases with depth to fit more nodes
    const childDistance = 0.5 / (depth + 1);

    for (let i = 0; i < numChildren; i++) {
      const angle = startAngle + i * angleStep;

      // Create tangent vector in the direction of the angle
      const tangent = zeros(this.dimension);
      tangent[0] = childDistance * Math.cos(angle);
      if (this.dimension > 1) {
        tangent[1] = childDistance * Math.sin(angle);
      }

      // Map to child position using exponential map
      const childPos = this.space.expMap(position, tangent);

      // Recursively embed children with reduced angular spread
      this.embedNode(
        node.children[i],
        childPos,
        depth + 1,
        angularSpread / numChildren,
        embeddings
      );
    }
  }

  /**
   * Gets the hyperbolic space instance for additional operations.
   */
  getSpace(): HyperbolicSpace {
    return this.space;
  }
}

/**
 * Recursive tree node interface for embedding.
 */
export interface TreeNode {
  id: string;
  children?: TreeNode[];
  data?: unknown;
}

/**
 * ASTEmbedder embeds Abstract Syntax Trees in hyperbolic space.
 *
 * Preserves the hierarchical structure of code, enabling:
 * - Similar code search
 * - Code clone detection
 * - Structural diff operations
 */
export class ASTEmbedder extends HierarchyEmbedder {
  /**
   * Embeds an AST node structure.
   *
   * @param ast - AST with type, children, and optional metadata
   * @returns Map of node paths to embeddings
   */
  embedAST(ast: ASTNode): Map<string, number[]> {
    const treeNode = this.astToTree(ast, '');
    return this.embedTree(treeNode);
  }

  private astToTree(node: ASTNode, path: string): TreeNode {
    const id = path ? `${path}/${node.type}` : node.type;
    const children = node.children?.map((child, i) =>
      this.astToTree(child, `${id}[${i}]`)
    );

    return {
      id,
      children,
      data: {
        type: node.type,
        value: node.value,
        location: node.location,
      },
    };
  }
}

/**
 * AST node structure for embedding.
 */
export interface ASTNode {
  /** Node type (e.g., 'FunctionDeclaration', 'IfStatement') */
  type: string;
  /** Optional value (for literals, identifiers) */
  value?: unknown;
  /** Child nodes */
  children?: ASTNode[];
  /** Source location */
  location?: { start: number; end: number };
}

/**
 * DependencyGraphEmbedder embeds package/module dependency graphs.
 *
 * Captures both direct and transitive dependencies in hyperbolic space.
 */
export class DependencyGraphEmbedder {
  private readonly space: HyperbolicSpace;
  private readonly dimension: number;

  constructor(
    dimension: number,
    model: HyperbolicModel = 'poincare',
    curvature: number = DEFAULT_CURVATURE
  ) {
    this.dimension = dimension;
    this.space = new HyperbolicSpace(model, curvature);
  }

  /**
   * Embeds a dependency graph.
   *
   * @param graph - Map of package names to their dependencies
   * @param root - Optional root package (placed at origin)
   * @returns Map of package names to embeddings
   */
  embedDependencyGraph(
    graph: Map<string, string[]>,
    root?: string
  ): Map<string, number[]> {
    const embeddings = new Map<string, number[]>();

    // Find root nodes (packages with no dependents)
    const roots = this.findRoots(graph);

    if (root && graph.has(root)) {
      // Use specified root
      const processed = new Set<string>();
      this.embedFromRoot(root, zeros(this.dimension), graph, embeddings, processed, 0);
    } else {
      // Embed from all roots
      const angleStep = (2 * Math.PI) / roots.length;
      const processed = new Set<string>();

      roots.forEach((rootNode, i) => {
        const angle = i * angleStep;
        const tangent = zeros(this.dimension);
        tangent[0] = 0.3 * Math.cos(angle);
        if (this.dimension > 1) {
          tangent[1] = 0.3 * Math.sin(angle);
        }

        const rootPos = this.space.expMap(zeros(this.dimension), tangent);
        this.embedFromRoot(rootNode, rootPos, graph, embeddings, processed, 0);
      });
    }

    return embeddings;
  }

  private findRoots(graph: Map<string, string[]>): string[] {
    const dependents = new Set<string>();
    for (const deps of graph.values()) {
      deps.forEach((d) => dependents.add(d));
    }

    return Array.from(graph.keys()).filter((k) => !dependents.has(k));
  }

  private embedFromRoot(
    node: string,
    position: number[],
    graph: Map<string, string[]>,
    embeddings: Map<string, number[]>,
    processed: Set<string>,
    depth: number
  ): void {
    if (processed.has(node)) {
      return;
    }

    processed.add(node);
    embeddings.set(node, position);

    const deps = graph.get(node) || [];
    const numDeps = deps.length;

    if (numDeps === 0) {
      return;
    }

    const angleStep = (2 * Math.PI) / numDeps;
    const depDistance = 0.4 / (depth + 1);

    deps.forEach((dep, i) => {
      if (processed.has(dep)) {
        return;
      }

      const angle = i * angleStep;
      const tangent = zeros(this.dimension);
      tangent[0] = depDistance * Math.cos(angle);
      if (this.dimension > 1) {
        tangent[1] = depDistance * Math.sin(angle);
      }

      const depPos = this.space.expMap(position, tangent);
      this.embedFromRoot(dep, depPos, graph, embeddings, processed, depth + 1);
    });
  }

  /**
   * Computes the dependency distance between two packages.
   *
   * @param a - First package name
   * @param b - Second package name
   * @param embeddings - Pre-computed embeddings
   * @returns Hyperbolic distance
   */
  dependencyDistance(
    a: string,
    b: string,
    embeddings: Map<string, number[]>
  ): number {
    const embA = embeddings.get(a);
    const embB = embeddings.get(b);

    if (!embA || !embB) {
      throw new Error(`Embedding not found for ${!embA ? a : b}`);
    }

    return this.space.distance(embA, embB);
  }

  /**
   * Gets the hyperbolic space instance.
   */
  getSpace(): HyperbolicSpace {
    return this.space;
  }
}

