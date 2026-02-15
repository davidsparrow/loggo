/**
 * DiffEngine — computes structural diff between two GraphData snapshots.
 *
 * Given a BeforeGraph (current workspace) and AfterGraph (temp-applied patch),
 * determines added/removed/changed nodes and edges, and builds DiffMeta maps
 * for rendering in the two-panel diff view (Section G + H).
 */

import { GraphData, GraphNode, GraphEdge, DiffStatus } from '../types/graph';
import { DiffMeta, DiffResult, FilePatch } from '../types/diff';

export class DiffEngine {

  /**
   * Compute the full diff between before and after graphs.
   */
  computeDiff(
    beforeGraph: GraphData,
    afterGraph: GraphData,
    patches: FilePatch[],
  ): DiffResult {
    // Index nodes by id
    const beforeNodes = new Map(beforeGraph.nodes.map(n => [n.id, n]));
    const afterNodes = new Map(afterGraph.nodes.map(n => [n.id, n]));

    // Index edges by id
    const beforeEdges = new Map(beforeGraph.edges.map(e => [e.id, e]));
    const afterEdges = new Map(afterGraph.edges.map(e => [e.id, e]));

    // Touched file paths from patches
    const touchedFiles = new Set(patches.map(p => p.filePath));

    // --- Compute node diffs ---
    const addedNodes: string[] = [];
    const removedNodes: string[] = [];
    const changedNodes: string[] = [];

    for (const [id, node] of afterNodes) {
      if (!beforeNodes.has(id)) {
        addedNodes.push(id);
      } else if (this._nodeChanged(beforeNodes.get(id)!, node)) {
        changedNodes.push(id);
      }
    }
    for (const id of beforeNodes.keys()) {
      if (!afterNodes.has(id)) {
        removedNodes.push(id);
      }
    }

    // --- Compute edge diffs ---
    const addedEdges: string[] = [];
    const removedEdges: string[] = [];

    for (const id of afterEdges.keys()) {
      if (!beforeEdges.has(id)) {
        addedEdges.push(id);
      }
    }
    for (const id of beforeEdges.keys()) {
      if (!afterEdges.has(id)) {
        removedEdges.push(id);
      }
    }

    // --- Build DiffMeta ---
    const diffMeta = this._buildDiffMeta(
      beforeGraph, afterGraph,
      addedNodes, removedNodes, changedNodes,
      addedEdges, removedEdges,
      touchedFiles,
    );

    return {
      beforeGraph,
      afterGraph,
      addedNodes,
      removedNodes,
      changedNodes,
      addedEdges,
      removedEdges,
      diffMeta,
      patches,
    };
  }

  /**
   * Check if a node has structurally changed (label, type, line, metadata).
   */
  private _nodeChanged(before: GraphNode, after: GraphNode): boolean {
    return (
      before.label !== after.label ||
      before.type !== after.type ||
      before.line !== after.line ||
      before.column !== after.column
    );
  }

  /**
   * Build the DiffMeta maps used by the diff view renderer.
   */
  private _buildDiffMeta(
    beforeGraph: GraphData,
    afterGraph: GraphData,
    addedNodes: string[],
    removedNodes: string[],
    changedNodes: string[],
    addedEdges: string[],
    removedEdges: string[],
    touchedFiles: Set<string>,
  ): DiffMeta {
    const nodeStatusById: Record<string, DiffStatus> = {};
    const edgeStatusByKey: Record<string, 'added' | 'removed' | 'unchanged'> = {};
    const acceptedByFileId: Record<string, boolean> = {};

    // Mark added / removed / changed nodes
    const addedSet = new Set(addedNodes);
    const removedSet = new Set(removedNodes);
    const changedSet = new Set(changedNodes);

    // Process all nodes from both graphs
    const allNodeIds = new Set([
      ...beforeGraph.nodes.map(n => n.id),
      ...afterGraph.nodes.map(n => n.id),
    ]);

    for (const id of allNodeIds) {
      if (addedSet.has(id)) {
        nodeStatusById[id] = 'added';
      } else if (removedSet.has(id)) {
        nodeStatusById[id] = 'removed';
      } else if (changedSet.has(id)) {
        nodeStatusById[id] = 'changed';
      } else {
        // Check if file is touched (file-level status)
        const node = afterGraph.nodes.find(n => n.id === id)
          || beforeGraph.nodes.find(n => n.id === id);
        if (node && touchedFiles.has(node.filePath)) {
          nodeStatusById[id] = 'touched';
        } else {
          nodeStatusById[id] = 'unchanged';
        }
      }
    }

    // Edge statuses
    const addedEdgeSet = new Set(addedEdges);
    const removedEdgeSet = new Set(removedEdges);
    const allEdgeIds = new Set([
      ...beforeGraph.edges.map(e => e.id),
      ...afterGraph.edges.map(e => e.id),
    ]);

    for (const id of allEdgeIds) {
      if (addedEdgeSet.has(id)) {
        edgeStatusByKey[id] = 'added';
      } else if (removedEdgeSet.has(id)) {
        edgeStatusByKey[id] = 'removed';
      } else {
        edgeStatusByKey[id] = 'unchanged';
      }
    }

    // Default all touched files to not-accepted
    for (const filePath of touchedFiles) {
      acceptedByFileId[filePath] = false;
    }

    return { nodeStatusById, edgeStatusByKey, acceptedByFileId };
  }
}
