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
import { TextSearchService } from './services/TextSearchService';
import { SemanticSearchService } from './services/SemanticSearchService';
import { AgentService } from './services/AgentService';
import { SearchMode } from './types/search';

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
  const textSearch = new TextSearchService();
  const semanticSearch = new SemanticSearchService(textSearch);
  const agentService = new AgentService();

  // Try to initialise semantic engine (non-blocking)
  semanticSearch.initialize().then((ok) => {
    if (ok) { console.log('[LogoCode] Semantic engine online'); }
  });

  // ── Shared search executor ──
  async function executeSearch(mode: SearchMode, query: string, opts: Record<string, unknown>) {
    if (!query) { return; }
    if (mode === 'text') {
      const results = await textSearch.search({
        query,
        isRegex: (opts.isRegex as boolean) || false,
        isCaseSensitive: (opts.isCaseSensitive as boolean) || false,
        isWholeWord: (opts.isWholeWord as boolean) || false,
        includeGlob: opts.includeGlob as string | undefined,
        excludeGlob: opts.excludeGlob as string | undefined,
      });
      searchProvider.setResults(results);
    } else {
      // Semantic mode — with fallback (Snippet 13)
      const { results, didFallback } = await semanticSearch.search({
        query,
        includeExternalFolders: (opts.includeExternalFolders as boolean) || false,
        topK: 20,
      });
      searchProvider.setResults(results);
      if (didFallback) {
        vscode.window.showInformationMessage('Semantic search unavailable — using text search.');
      }
    }
  }

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
      executeSearch('text', selected, {});
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
      executeSearch('semantic', selected, {});
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
      // Add selection as context and trigger plan
      chatProvider.addContext({
        id: `editor-${Date.now()}`,
        filePath: editor!.document.uri.fsPath,
        line: editor!.selection.start.line + 1,
        snippet: selected,
        source: 'editor',
        addedAt: Date.now(),
      });
      agentService.generatePlan(selected, [
        {
          id: `editor-${Date.now()}`,
          filePath: editor!.document.uri.fsPath,
          line: editor!.selection.start.line + 1,
          snippet: selected,
          source: 'editor',
          addedAt: Date.now(),
        },
      ]);
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

  // Search execution — wired to TextSearchService + SemanticSearchService
  searchProvider.onSearch = (mode, query, opts) => {
    executeSearch(mode, query, opts);
  };

  // Saved → execute preset (switches to search, restores params, auto-executes)
  savedProvider.onExecutePreset = (preset) => {
    searchProvider.setMode(preset.mode);
    const query = preset.textOptions?.query || preset.semanticOptions?.query || '';
    searchProvider.setQuery(query);
    const opts = preset.mode === 'text'
      ? { ...(preset.textOptions || {}) }
      : { ...(preset.semanticOptions || {}) };
    executeSearch(preset.mode, query, opts);
  };

  // ── Agent callbacks ──

  agentService.callbacks = {
    onPhaseChange: (phase) => {
      chatProvider.addMessage({
        id: `phase-${Date.now()}`,
        role: 'system',
        content: `Agent phase: ${phase}`,
        timestamp: Date.now(),
      });
    },
    onPlan: (plan) => {
      const summary = plan.planSteps.map(s => `• ${s.description}`).join('\n');
      chatProvider.addMessage({
        id: `plan-${Date.now()}`,
        role: 'agent',
        content: `**Plan** (${plan.planSteps.length} steps)\n${summary}`,
        timestamp: Date.now(),
      });
    },
    onDiffResult: (_result) => {
      chatProvider.addMessage({
        id: `diff-${Date.now()}`,
        role: 'agent',
        content: 'Diff computed. Review files and click "Apply Selected" when ready.',
        timestamp: Date.now(),
      });
    },
    onApplyResult: (result) => {
      chatProvider.addMessage({
        id: `apply-${Date.now()}`,
        role: 'agent',
        content: result.error
          ? `Apply error: ${result.error}`
          : `Applied ${result.applied.length} file(s), skipped ${result.skipped.length}.`,
        timestamp: Date.now(),
      });
    },
    onMessage: (content) => {
      chatProvider.addMessage({
        id: `msg-${Date.now()}`,
        role: 'agent',
        content,
        timestamp: Date.now(),
      });
    },
    getGraphData: async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) { return { nodes: [], edges: [] }; }
      try {
        const result = await analyzer.analyzeWorkspace(workspacePath);
        return await extractor.extractGraphData(analyzer, result);
      } catch {
        return { nodes: [], edges: [] };
      }
    },
  };

  // ── Chat → Agent flow ──

  chatProvider.onUserMessage = (text, ctx) => {
    // Slash-commands for diff workflow
    if (text.toLowerCase() === '/diff' || text.toLowerCase() === 'generate diff') {
      agentService.generateDiff();
      return;
    }
    if (text.toLowerCase() === '/apply' || text.toLowerCase() === 'apply selected') {
      agentService.applyChanges();
      return;
    }
    if (text.toLowerCase() === '/reset') {
      agentService.reset();
      chatProvider.addMessage({
        id: `reset-${Date.now()}`, role: 'system',
        content: 'Agent reset to idle.', timestamp: Date.now(),
      });
      return;
    }
    if (text.toLowerCase() === '/accept-all') {
      const dm = agentService.diffMeta;
      if (dm) { agentService.applyService.acceptAllTouched(dm); }
      return;
    }
    if (text.toLowerCase() === '/accept-none') {
      const dm = agentService.diffMeta;
      if (dm) { agentService.applyService.acceptNone(dm); }
      return;
    }

    // Default: generate a plan from user message + context
    agentService.generatePlan(text, ctx);
  };

  // --- Language Model Tool registration ---
  // TODO: Register CodemapTool with vscode.lm.registerTool

  console.log('[LogoCode] Extension activated ✓');
}

// ── Deactivate ────────────────────────────────────────────

export function deactivate() {
  console.log('[LogoCode] Extension deactivated.');
}

