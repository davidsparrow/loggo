/**
 * Graph data types — extends llm-codemap types with diff support.
 */

/** Node types in the graph */
export enum NodeType {
  File = 'file',
  Function = 'function',
  Class = 'class',
  Method = 'method',
  Interface = 'interface',
  Type = 'type',
  Variable = 'variable',
}

/** Edge relationship types */
export enum EdgeType {
  Import = 'import',
  Export = 'export',
  Call = 'call',
  Extends = 'extends',
  Implements = 'implements',
  Reference = 'reference',
}

/** Diff status for nodes in diff mode */
export type DiffStatus = 'touched' | 'added' | 'removed' | 'changed' | 'context' | 'unchanged';

/** Graph node */
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  filePath: string;
  line?: number;
  column?: number;
  parentId?: string;
  metadata?: {
    diffStatus?: DiffStatus;
    [key: string]: unknown;
  };
}

/** Graph edge */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  metadata?: {
    [key: string]: unknown;
  };
}

/** Complete graph data */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** D3-compatible node */
export interface D3Node {
  id: string;
  label: string;
  type: string;
  group: number;
  filePath?: string;
  line?: number;
  column?: number;
  metadata?: Record<string, unknown>;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

/** D3-compatible link with stable id */
export interface D3Link {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  value?: number;
}

/** D3-compatible graph data */
export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
}

