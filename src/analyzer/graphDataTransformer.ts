/**
 * Graph data transformer — converts analysis graph to D3-compatible format.
 *
 * Key additions over llm-codemap:
 *  - Stable edge IDs for diff matching (Section H / Snippet 6)
 *  - Color helpers for node and edge types
 */

import {
  GraphData,
  GraphNode,
  GraphEdge,
  D3Node,
  D3Link,
  D3GraphData,
  NodeType,
  EdgeType,
} from '../types/graph';

// ── Transform ─────────────────────────────────────────────

/** Transform GraphData to D3-compatible format */
export function transformToD3Format(graphData: GraphData): D3GraphData {
  const nodes = graphData.nodes.map(transformNode);
  const links = graphData.edges.map(transformLink);
  return { nodes, links };
}

function transformNode(node: GraphNode): D3Node {
  return {
    id: node.id,
    label: node.label,
    type: String(node.type),
    group: getNodeGroup(node.type),
    filePath: node.filePath,
    line: node.line,
    column: node.column,
    metadata: node.metadata,
  };
}

/** Stable edge ID — Section H / Snippet 6 */
function transformLink(edge: GraphEdge): D3Link {
  return {
    id: edge.id || makeEdgeKey(edge),
    source: String(edge.source),
    target: String(edge.target),
    type: String(edge.type),
    label: edge.label,
    value: getEdgeValue(edge.type),
  };
}

/** Deterministic edge key for diff matching */
export function makeEdgeKey(edge: { type: string; source: string; target: string; label?: string }): string {
  const label = edge.label ? `:${edge.label}` : '';
  return `${edge.type}:${edge.source}->${edge.target}${label}`;
}

// ── Group / Value Mapping ─────────────────────────────────

function getNodeGroup(nodeType: NodeType): number {
  const map: Record<string, number> = {
    [NodeType.File]: 1,
    [NodeType.Function]: 2,
    [NodeType.Class]: 3,
    [NodeType.Method]: 4,
    [NodeType.Interface]: 5,
    [NodeType.Type]: 6,
    [NodeType.Variable]: 7,
  };
  return map[nodeType] ?? 0;
}

function getEdgeValue(edgeType: EdgeType): number {
  const map: Record<string, number> = {
    [EdgeType.Import]: 1,
    [EdgeType.Export]: 1,
    [EdgeType.Call]: 2,
    [EdgeType.Extends]: 3,
    [EdgeType.Implements]: 2,
    [EdgeType.Reference]: 1,
  };
  return map[edgeType] ?? 1;
}

// ── Color Helpers ─────────────────────────────────────────

/** Minimalist, muted palette for node types */
export function getNodeColor(nodeType: NodeType | string): string {
  const colors: Record<string, string> = {
    [NodeType.File]: '#5B8DEF',      // soft blue
    [NodeType.Function]: '#E8915A',  // warm orange
    [NodeType.Class]: '#5EC269',     // fresh green
    [NodeType.Method]: '#E06C75',    // muted red
    [NodeType.Interface]: '#B07CD8', // lavender
    [NodeType.Type]: '#8C6B4F',      // brown
    [NodeType.Variable]: '#D899BA',  // rose
  };
  return colors[nodeType] ?? '#8B8B8B';
}

/** Edge color palette */
export function getEdgeColor(edgeType: EdgeType | string): string {
  const colors: Record<string, string> = {
    [EdgeType.Import]: '#5B8DEF',
    [EdgeType.Export]: '#5EC269',
    [EdgeType.Call]: '#E8915A',
    [EdgeType.Extends]: '#E06C75',
    [EdgeType.Implements]: '#B07CD8',
    [EdgeType.Reference]: '#8B8B8B',
  };
  return colors[edgeType] ?? '#8B8B8B';
}

