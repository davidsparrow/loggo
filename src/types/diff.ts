/**
 * Diff engine types — Plan → Diff → Apply workflow.
 */

import { DiffStatus } from './graph';

/** Diff metadata contract (Section H / Snippet 17) */
export interface DiffMeta {
  /** Per-node status: touched, added, removed, changed, context, unchanged */
  nodeStatusById: Record<string, DiffStatus>;
  /** Per-edge status: added, removed, unchanged */
  edgeStatusByKey: Record<string, 'added' | 'removed' | 'unchanged'>;
  /** Per-file accept toggle (MVP = file-level) */
  acceptedByFileId: Record<string, boolean>;
}

/** A single step in the agent plan */
export interface PlanStep {
  id: string;
  description: string;
  filePath?: string;
  type: 'create' | 'modify' | 'delete' | 'rename';
  status: 'pending' | 'diffed' | 'applied' | 'rejected';
}

/** Agent plan returned before diff generation */
export interface AgentPlan {
  planSteps: PlanStep[];
  touchedFiles: string[];
  touchedSymbols?: string[];
}

/** A file-level patch produced by the diff engine */
export interface FilePatch {
  filePath: string;
  originalContent: string;
  patchedContent: string;
}

/** Complete diff result between before and after graphs */
export interface DiffResult {
  beforeGraph: import('./graph').GraphData;
  afterGraph: import('./graph').GraphData;
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  diffMeta: DiffMeta;
  patches: FilePatch[];
}

