/**
 * Search types — Unified search (Text + Semantic).
 */

/** Search mode toggle */
export type SearchMode = 'text' | 'semantic';

/** Text search options (VS Code search API) */
export interface TextSearchOptions {
  query: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  includeGlob?: string;
  excludeGlob?: string;
}

/** Semantic search options (RuVector) */
export interface SemanticSearchOptions {
  query: string;
  includeExternalFolders: boolean;
  topK?: number;
}

/** A single search result (shared across both modes) */
export interface SearchResultItem {
  id: string;
  filePath: string;
  fileName: string;
  line?: number;
  column?: number;
  preview: string;
  matchRange?: { start: number; end: number };
  /** Relevance score (semantic mode) */
  score?: number;
  /** Source of result */
  source: SearchMode;
}

/** A saved search preset */
export interface SavedSearchPreset {
  id: string;
  name: string;
  mode: SearchMode;
  textOptions?: TextSearchOptions;
  semanticOptions?: SemanticSearchOptions;
  /** Variables that require manual input before execution */
  manualVariables?: string[];
  createdAt: number;
}

/** External folder registered for semantic indexing */
export interface ExternalFolder {
  id: string;
  path: string;
  label: string;
  indexed: boolean;
  lastIndexed?: number;
}

