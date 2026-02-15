/**
 * LogoCode — main extension entry point.
 *
 * Registers the sidebar webview providers, commands, and LM tools.
 * Heavy logic lives in services/; this file is thin orchestration.
 */

import * as vscode from 'vscode';

// ── Activate ──────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log('[LogoCode] Extension activating…');

  // --- Open Graph Canvas command (editor-area WebviewPanel) ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.openCanvas', () => {
      // TODO (Chunk 2): Implement CodemapViewProvider + WebviewPanel
      vscode.window.showInformationMessage('LogoCode: Graph Canvas — coming in Chunk 2');
    })
  );

  // --- Refresh analysis ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.refresh', async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showWarningMessage('Open a workspace first.');
        return;
      }
      // TODO (Chunk 2): Run analyzer + update graph
      vscode.window.showInformationMessage('LogoCode: Refresh — coming in Chunk 2');
    })
  );

  // --- Editor context-menu: text search ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.searchFromSelection.text', () => {
      const editor = vscode.window.activeTextEditor;
      const selected = editor?.document.getText(editor.selection);
      if (!selected) {
        vscode.window.showWarningMessage('Select text first.');
        return;
      }
      // TODO (Chunk 4): Trigger text search with `selected`
      vscode.window.showInformationMessage(`Text search: "${selected}" — coming in Chunk 4`);
    })
  );

  // --- Editor context-menu: semantic search ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.searchFromSelection.semantic', () => {
      const editor = vscode.window.activeTextEditor;
      const selected = editor?.document.getText(editor.selection);
      if (!selected) {
        vscode.window.showWarningMessage('Select text first.');
        return;
      }
      // TODO (Chunk 4): Trigger semantic search with `selected`
      vscode.window.showInformationMessage(`Semantic search: "${selected}" — coming in Chunk 4`);
    })
  );

  // --- Editor context-menu: ask agent ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.askAgent', () => {
      const editor = vscode.window.activeTextEditor;
      const selected = editor?.document.getText(editor.selection);
      if (!selected) {
        vscode.window.showWarningMessage('Select text first.');
        return;
      }
      // TODO (Chunk 5): Pass to agent orchestration
      vscode.window.showInformationMessage(`Ask Agent: "${selected}" — coming in Chunk 5`);
    })
  );

  // --- Language Model Tool registration ---
  // TODO (Chunk 2+): Register CodemapTool with vscode.lm.registerTool

  console.log('[LogoCode] Extension activated ✓');
}

// ── Deactivate ────────────────────────────────────────────

export function deactivate() {
  console.log('[LogoCode] Extension deactivated.');
}

