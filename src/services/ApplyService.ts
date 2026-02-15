/**
 * ApplyService — applies accepted file patches atomically via vscode.workspace.applyEdit.
 *
 * MVP: file-level patching (not hunk-level).
 * Uses a single WorkspaceEdit so the operation is atomic and undo-able.
 * On failure, shows error and offers manual rollback guidance. (Section G / Snippet 11)
 */

import * as vscode from 'vscode';
import { FilePatch, DiffMeta } from '../types/diff';

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  error?: string;
}

export class ApplyService {

  /**
   * Apply all accepted patches as a single atomic WorkspaceEdit.
   *
   * Only patches whose filePath is marked `true` in acceptedByFileId are applied.
   * Returns summary of what was applied vs skipped.
   */
  async applyPatches(
    patches: FilePatch[],
    diffMeta: DiffMeta,
  ): Promise<ApplyResult> {
    const applied: string[] = [];
    const skipped: string[] = [];

    // Filter to accepted files only
    const accepted = patches.filter(p => diffMeta.acceptedByFileId[p.filePath] === true);
    const rejected = patches.filter(p => diffMeta.acceptedByFileId[p.filePath] !== true);

    for (const p of rejected) { skipped.push(p.filePath); }

    if (accepted.length === 0) {
      return { applied, skipped, error: 'No files accepted for apply.' };
    }

    // Build a single atomic WorkspaceEdit (Snippet 11)
    const edit = new vscode.WorkspaceEdit();

    try {
      for (const patch of accepted) {
        const uri = vscode.Uri.file(patch.filePath);

        // Ensure file exists / is open so we can get line count
        const doc = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(doc.lineCount, 0),
        );

        edit.replace(uri, fullRange, patch.patchedContent);
        applied.push(patch.filePath);
      }

      const success = await vscode.workspace.applyEdit(edit);

      if (!success) {
        return {
          applied: [],
          skipped: [...applied, ...skipped],
          error: 'vscode.workspace.applyEdit returned false — no changes were made.',
        };
      }

      // Save all modified docs
      for (const filePath of applied) {
        const uri = vscode.Uri.file(filePath);
        const doc = vscode.workspace.textDocuments.find(
          d => d.uri.fsPath === uri.fsPath
        );
        if (doc && doc.isDirty) {
          await doc.save();
        }
      }

      return { applied, skipped };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(
        `LogoCode: Apply failed — ${msg}. Use Edit → Undo to rollback.`
      );
      return { applied: [], skipped: patches.map(p => p.filePath), error: msg };
    }
  }

  /**
   * Toggle accept state for a single file.
   */
  toggleAccept(diffMeta: DiffMeta, filePath: string): void {
    diffMeta.acceptedByFileId[filePath] = !diffMeta.acceptedByFileId[filePath];
  }

  /**
   * Accept all touched files.
   */
  acceptAllTouched(diffMeta: DiffMeta): void {
    for (const fp of Object.keys(diffMeta.acceptedByFileId)) {
      diffMeta.acceptedByFileId[fp] = true;
    }
  }

  /**
   * Accept none.
   */
  acceptNone(diffMeta: DiffMeta): void {
    for (const fp of Object.keys(diffMeta.acceptedByFileId)) {
      diffMeta.acceptedByFileId[fp] = false;
    }
  }
}

