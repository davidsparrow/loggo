/**
 * SemanticSearchService — RuVector-based semantic search.
 *
 * Current implementation is a **placeholder stub** that always falls back
 * to TextSearchService (Snippet 13 — "If semantic engine unavailable,
 * fallback to text search; show subtle banner").
 *
 * Once RuVector is integrated, this will:
 *   • Index project files via embeddings
 *   • Index external folders from the folder registry
 *   • Accept natural-language queries
 *   • Return ranked results by cosine similarity
 */

import * as vscode from 'vscode';
import { SearchResultItem, SemanticSearchOptions } from '../types/search';
import { TextSearchService } from './TextSearchService';

export class SemanticSearchService {
  /** Whether the RuVector engine is online */
  private _available = false;

  constructor(private readonly _textFallback: TextSearchService) {}

  /** Check engine availability */
  get isAvailable(): boolean {
    return this._available;
  }

  /**
   * Attempt to initialize the RuVector engine.
   * Currently a no-op stub — returns false.
   */
  async initialize(): Promise<boolean> {
    // TODO: Connect to RuVector engine, build/load index
    // this._available = await ruvectorEngine.connect();
    this._available = false;
    return this._available;
  }

  /**
   * Index (or re-index) the current workspace files.
   * Stub — no-op until RuVector is wired.
   */
  async indexWorkspace(): Promise<void> {
    // TODO: Walk workspace files, generate embeddings, upsert into RuVector
    console.log('[SemanticSearch] indexWorkspace — stub (no-op)');
  }

  /**
   * Index an external folder for cross-project search.
   * Stub — no-op until RuVector is wired.
   */
  async indexExternalFolder(_folderPath: string): Promise<void> {
    // TODO: Walk external folder, generate embeddings, upsert
    console.log('[SemanticSearch] indexExternalFolder — stub (no-op)');
  }

  /**
   * Execute a semantic search.
   *
   * Implements Snippet 13: try semantic → catch → fallback to text search.
   */
  async search(
    opts: SemanticSearchOptions,
    token?: vscode.CancellationToken,
  ): Promise<{ results: SearchResultItem[]; didFallback: boolean }> {
    if (!opts.query) {
      return { results: [], didFallback: false };
    }

    // --- Try semantic search first ---
    if (this._available) {
      try {
        const results = await this._runSemanticSearch(opts, token);
        return { results, didFallback: false };
      } catch (e) {
        console.warn('[SemanticSearch] Engine error, falling back to text:', e);
        // Fall through to text fallback below
      }
    }

    // --- Fallback: use text search (Snippet 13) ---
    const textResults = await this._textFallback.search(
      {
        query: opts.query,
        isRegex: false,
        isCaseSensitive: false,
        isWholeWord: false,
      },
      token,
    );

    // Re-tag results as coming through semantic (fallback)
    const retagged = textResults.map((r) => ({
      ...r,
      source: 'semantic' as const,
    }));

    return { results: retagged, didFallback: true };
  }

  /**
   * Internal semantic search — placeholder.
   * Will use RuVector embeddings + cosine similarity when wired.
   */
  private async _runSemanticSearch(
    _opts: SemanticSearchOptions,
    _token?: vscode.CancellationToken,
  ): Promise<SearchResultItem[]> {
    // TODO: Generate query embedding → kNN search in RuVector index
    // const embedding = await ruvectorEngine.embed(opts.query);
    // const neighbors = await ruvectorEngine.search(embedding, opts.topK ?? 20);
    // return neighbors.map(n => ({ ... }));
    throw new Error('RuVector engine not yet implemented');
  }
}

