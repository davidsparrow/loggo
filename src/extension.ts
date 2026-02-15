/**
 * LogoCode — main extension entry point.
 *
 * Registers the sidebar webview providers, commands, and LM tools.
 * Heavy logic lives in services/; this file is thin orchestration.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodemapViewProvider } from './webview/CodemapViewProvider';
import { FilesViewProvider } from './webview/FilesViewProvider';
import { ChatViewProvider } from './webview/ChatViewProvider';
import { SearchViewProvider } from './webview/SearchViewProvider';
import { SavedViewProvider } from './webview/SavedViewProvider';
import { TypeScriptAnalyzer } from './analyzer/TypeScriptAnalyzer';
import { DependencyExtractor } from './analyzer/DependencyExtractor';

// ── Activate ──────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log('[LogoCode] Extension activating…');

  // ── Core instances ──
  const canvasProvider = new CodemapViewProvider(context.extensionUri);
  const filesProvider = new FilesViewProvider(context.extensionUri);
  const chatProvider = new ChatViewProvider(context.extensionUri);
  const searchProvider = new SearchViewProvider(context.extensionUri);
  const savedProvider = new SavedViewProvider(context.extensionUri);
  const analyzer = new TypeScriptAnalyzer();
  const extractor = new DependencyExtractor();

  // ── Register sidebar webview providers ──
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FilesViewProvider.viewType, filesProvider),
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider),
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, searchProvider),
    vscode.window.registerWebviewViewProvider(SavedViewProvider.viewType, savedProvider),
  );

  // --- Open Graph Canvas command (editor-area WebviewPanel) ---
  context.subscriptions.push(
    vscode.commands.registerCommand('logocode.openCanvas', () => {
      canvasProvider.show();
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
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'LogoCode: Analysing…', cancellable: false },
        async () => {
          try {
            const result = await analyzer.analyzeWorkspace(workspacePath);
            const graphData = await extractor.extractGraphData(analyzer, result);
            canvasProvider.updateGraph(graphData);

            // Populate Files panel
            const files = result.files.map(f => ({
              path: f.path,
              name: path.basename(f.path),
              dir: path.relative(workspacePath, path.dirname(f.path)) || '.',
            }));
            filesProvider.setFiles(files);

            vscode.window.showInformationMessage(
              `LogoCode: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`
            );
          } catch (e) {
            vscode.window.showErrorMessage(`LogoCode analysis failed: ${e}`);
          }
        }
      );
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
      searchProvider.setMode('text');
      searchProvider.setQuery(selected);
      // TODO (Chunk 4): auto-execute text search
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
      searchProvider.setMode('semantic');
      searchProvider.setQuery(selected);
      // TODO (Chunk 4): auto-execute semantic search
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

  // ── Panel callbacks ──

  // Search → result click opens file
  searchProvider.onResultClick = (result) => {
    const uri = vscode.Uri.file(result.filePath);
    vscode.workspace.openTextDocument(uri).then((doc) => {
      const opts: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.One };
      if (result.line) {
        const pos = new vscode.Position(result.line - 1, result.column ? result.column - 1 : 0);
        opts.selection = new vscode.Range(pos, pos);
      }
      vscode.window.showTextDocument(doc, opts);
    });
  };

  // Search → add result to agent context
  searchProvider.onAddToAgent = (result) => {
    chatProvider.addContext({
      id: `search-${Date.now()}`,
      filePath: result.filePath,
      line: result.line,
      snippet: result.preview,
      source: 'search',
      addedAt: Date.now(),
    });
    vscode.window.showInformationMessage(`Added to agent context: ${result.fileName}`);
  };

  // Search execution placeholder (actual implementation in Chunk 4)
  searchProvider.onSearch = (mode, query, _opts) => {
    vscode.window.showInformationMessage(`Search (${mode}): "${query}" — full implementation in Chunk 4`);
  };

  // Saved → execute preset (switches to search, restores params, runs)
  savedProvider.onExecutePreset = (preset) => {
    searchProvider.setMode(preset.mode);
    const query = preset.textOptions?.query || preset.semanticOptions?.query || '';
    searchProvider.setQuery(query);
    // TODO (Chunk 4): auto-execute the restored search
    vscode.window.showInformationMessage(`Running preset: ${preset.name}`);
  };

  // --- Language Model Tool registration ---
  // TODO: Register CodemapTool with vscode.lm.registerTool

  console.log('[LogoCode] Extension activated ✓');
}

// ── Deactivate ────────────────────────────────────────────

export function deactivate() {
  console.log('[LogoCode] Extension deactivated.');
}

