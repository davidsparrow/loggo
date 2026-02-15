/**
 * File operation utilities — adapted from llm-codemap.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Default exclude patterns for workspace searches */
const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/tmp/**',
  '**/temp/**',
  '**/*.min.js',
  '**/*.bundle.js',
].join(',');

/** Find files in workspace matching a glob pattern */
export async function findFiles(pattern: string, exclude?: string): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles(pattern, exclude || DEFAULT_EXCLUDES);
}

/** Read file content as UTF-8 string */
export async function readFileContent(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}

/** Check if file exists */
export function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** Check if directory exists */
export function directoryExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/** Get file extension (lowercase) */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/** Check if file is TypeScript/JavaScript */
export function isTypeScriptOrJavaScriptFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
}

/** Paths to exclude from analysis */
const EXCLUDE_PATTERNS = [
  '/node_modules/', '/.git/', '/dist/', '/build/', '/.next/',
  '/out/', '/coverage/', '/.cache/', '/tmp/', '/temp/',
  '/.vscode/', '/.idea/', '/.vs/',
];

/** Check if a file path should be excluded from analysis */
export function shouldExcludeFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return EXCLUDE_PATTERNS.some((p) => normalized.includes(p));
}

/** Recursively get files in a directory, with optional regex filter */
export function getFilesRecursively(dirPath: string, pattern?: RegExp): string[] {
  const files: string[] = [];
  if (!directoryExists(dirPath)) { return files; }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') { continue; }
      files.push(...getFilesRecursively(fullPath, pattern));
    } else if (entry.isFile()) {
      if (!pattern || pattern.test(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

