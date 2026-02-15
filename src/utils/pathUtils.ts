/**
 * Path manipulation utilities — adapted from llm-codemap.
 */

import * as path from 'path';
import * as vscode from 'vscode';

/** Normalize a path, resolving against basePath if relative */
export function normalizePath(filePath: string, basePath?: string): string {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  if (basePath) {
    return path.normalize(path.resolve(basePath, filePath));
  }
  return path.normalize(filePath);
}

/** Get path relative to workspace root */
export function getRelativePath(
  filePath: string,
  workspaceFolder?: vscode.WorkspaceFolder
): string {
  const wsPath = workspaceFolder?.uri.fsPath;
  if (wsPath && filePath.startsWith(wsPath)) {
    return path.relative(wsPath, filePath);
  }
  return filePath;
}

/** Compute relative path between two files */
export function getRelativePathBetween(from: string, to: string): string {
  return path.relative(path.dirname(from), to);
}

/** Convert file path to VS Code URI */
export function pathToUri(filePath: string): vscode.Uri {
  return vscode.Uri.file(filePath);
}

/** Convert VS Code URI to file path */
export function uriToPath(uri: vscode.Uri): string {
  return uri.fsPath;
}

/** Compare two paths after normalization */
export function pathsEqual(path1: string, path2: string): boolean {
  return path.normalize(path1) === path.normalize(path2);
}

/** Get filename without extension */
export function getFileNameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/** Get directory path */
export function getDirectoryPath(filePath: string): string {
  return path.dirname(filePath);
}

