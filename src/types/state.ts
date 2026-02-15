/**
 * Central panel state model (Section N / Snippet 16).
 *
 * Single source of truth for the entire extension UI.
 */

import { SearchMode, SearchResultItem, SavedSearchPreset, ExternalFolder } from './search';
import { ContextItem, ChatMessage, FileComment, ChatMode, AgentPhase } from './agent';
import { DiffMeta, AgentPlan } from './diff';
import { McpServer, Connector } from './connectors';
import { GraphData } from './graph';

/** Hover state for cross-panel sync */
export interface HoverState {
  kind: 'node' | 'edge';
  id: string;
}

/** Selection state */
export interface SelectionState {
  kind: 'node' | 'edge';
  id: string;
  sourcePanel?: 'before' | 'after' | 'main';
}

/** Active sidebar tab */
export type SidebarTab = 'files' | 'chat' | 'search' | 'saved';

/** Graph canvas render mode */
export type CanvasMode = 'normal' | 'diff';

/** Central panel state — the master state object */
export interface PanelState {
  // --- Sidebar ---
  activeTab: SidebarTab;

  // --- Search ---
  searchMode: SearchMode;
  searchResults: SearchResultItem[];
  savedPresets: SavedSearchPreset[];

  // --- Chat / Agent ---
  chatMode: ChatMode;
  chatMessages: ChatMessage[];
  agentContext: ContextItem[];
  agentPhase: AgentPhase;
  agentPlan?: AgentPlan;

  // --- File Comments ---
  fileComments: FileComment[];

  // --- Graph Canvas ---
  canvasMode: CanvasMode;
  graphData?: GraphData;

  // --- Diff ---
  diffMeta?: DiffMeta;

  // --- Hover / Selection (cross-panel sync) ---
  hoverState: HoverState | null;
  selectionState: SelectionState | null;

  // --- MCP + Connectors ---
  mcpServers: McpServer[];
  connectors: Connector[];

  // --- External Folders (semantic search) ---
  externalFolders: ExternalFolder[];
}

/** Default initial state */
export function createInitialState(): PanelState {
  return {
    activeTab: 'files',
    searchMode: 'text',
    searchResults: [],
    savedPresets: [],
    chatMode: 'agent',
    chatMessages: [],
    agentContext: [],
    agentPhase: 'idle',
    fileComments: [],
    canvasMode: 'normal',
    diffMeta: undefined,
    hoverState: null,
    selectionState: null,
    mcpServers: [],
    connectors: [],
    externalFolders: [],
  };
}

