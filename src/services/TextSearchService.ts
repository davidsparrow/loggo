/**
 * TextSearchService — workspace text search using VS Code APIs.
 *
 * Finds files via vscode.workspace.findFiles, reads content,
 * and matches line-by-line with regex / literal options.
 * Supports: regex toggle, case sensitivity, whole word, include/exclude globs.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SearchResultItem, TextSearchOptions } from '../types/search';

/** Default excludes for search */
const DEFAULT_EXCLUDES = '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/out/**,**/coverage/**,**/*.min.js,**/*.bundle.js}';

/** Maximum files to scan in one search run */
const MAX_FILES = 5000;

/** Maximum results to return */
const MAX_RESULTS = 200;

export class TextSearchService {

  /**
   * Execute a text search across the workspace.
   */
  async search(opts: TextSearchOptions, token?: vscode.CancellationToken): Promise<SearchResultItem[]> {
    const { query, isRegex, isCaseSensitive, isWholeWord, includeGlob, excludeGlob } = opts;
    if (!query) { return []; }

    // Build the regex for matching
    let pattern: string;
    if (isRegex) {
      pattern = query;
    } else {
      // Escape regex special chars for literal matching
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (isWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
    } catch {
      // Invalid regex — return empty
      return [];
    }

    // Resolve include/exclude globs
    const include = includeGlob || '**/*';
    const exclude = excludeGlob
      ? `{${excludeGlob},${DEFAULT_EXCLUDES.slice(1, -1)}}`
      : DEFAULT_EXCLUDES;

    // Find candidate files
    const uris = await vscode.workspace.findFiles(include, exclude, MAX_FILES, token);
    if (token?.isCancellationRequested) { return []; }

    const results: SearchResultItem[] = [];
    let resultId = 0;

    for (const uri of uris) {
      if (token?.isCancellationRequested) { break; }
      if (results.length >= MAX_RESULTS) { break; }

      // Skip binary / large files by extension
      const ext = path.extname(uri.fsPath).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) { continue; }

      let content: string;
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(bytes).toString('utf-8');
      } catch {
        continue; // unreadable — skip
      }

      // Quick whole-file check before line-by-line
      if (!regex.test(content)) { continue; }
      regex.lastIndex = 0; // reset after test

      const lines = content.split('\n');
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const relPath = path.relative(wsRoot, uri.fsPath);
      const fileName = path.basename(uri.fsPath);

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= MAX_RESULTS) { break; }

        const line = lines[i];
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (!match) { continue; }

        results.push({
          id: `text-${resultId++}`,
          filePath: uri.fsPath,
          fileName,
          line: i + 1,
          column: match.index + 1,
          preview: linePreview(line, match.index, match[0].length),
          matchRange: { start: match.index, end: match.index + match[0].length },
          source: 'text',
        });
      }
    }

    return results;
  }
}

/** Trim long lines around the match for display */
function linePreview(line: string, matchStart: number, matchLen: number): string {
  const maxLen = 120;
  const trimmed = line.trimStart();
  const offset = line.length - trimmed.length;
  const adjStart = matchStart - offset;

  if (trimmed.length <= maxLen) { return trimmed; }

  // Center the preview around the match
  const contextBefore = 30;
  let start = Math.max(0, adjStart - contextBefore);
  let end = Math.min(trimmed.length, start + maxLen);
  if (end - start < maxLen) { start = Math.max(0, end - maxLen); }

  let preview = trimmed.slice(start, end);
  if (start > 0) { preview = '…' + preview; }
  if (end < trimmed.length) { preview = preview + '…'; }
  return preview;
}

/** Known binary file extensions to skip */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mov', '.mkv',
  '.zip', '.gz', '.tar', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.o', '.obj',
  '.pyc', '.pyo', '.class', '.wasm',
  '.sqlite', '.db',
]);

