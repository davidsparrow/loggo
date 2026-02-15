/**
 * Agent types — Chat + Agent orchestration.
 */

/** Agent context item (added from search results, editor selections, etc.) */
export interface ContextItem {
  id: string;
  filePath: string;
  line?: number;
  snippet: string;
  source: 'search' | 'editor' | 'graph' | 'manual';
  addedAt: number;
}

/** Chat message */
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  /** Attached context items for this message */
  context?: ContextItem[];
}

/** File comment thread */
export interface FileComment {
  id: string;
  filePath: string;
  line?: number;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/** Chat panel mode */
export type ChatMode = 'agent' | 'comments';

/** Agent workflow phase */
export type AgentPhase = 'idle' | 'planning' | 'diffing' | 'reviewing' | 'applying';

