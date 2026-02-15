/**
 * AgentService — orchestrates the Plan → Diff → Apply workflow (Section G).
 *
 * Phase transitions:
 *   idle → planning → diffing → reviewing → applying → idle
 *
 * MVP: stub LLM integration — generates simple plan + patches from user request.
 * Real LLM integration will be swapped in later (via vscode.lm or external API).
 */

import * as vscode from 'vscode';
import { AgentPhase, ContextItem } from '../types/agent';
import { AgentPlan, PlanStep, FilePatch, DiffResult, DiffMeta } from '../types/diff';
import { GraphData } from '../types/graph';
import { DiffEngine } from './DiffEngine';
import { ApplyService, ApplyResult } from './ApplyService';

export interface AgentCallbacks {
  /** Called when the agent phase changes */
  onPhaseChange?: (phase: AgentPhase) => void;
  /** Called when a plan is generated */
  onPlan?: (plan: AgentPlan) => void;
  /** Called when a diff result is ready */
  onDiffResult?: (result: DiffResult) => void;
  /** Called when apply completes */
  onApplyResult?: (result: ApplyResult) => void;
  /** Called to send a system message back to the chat UI */
  onMessage?: (content: string) => void;
  /** Called to request current graph data from the analyzer */
  getGraphData?: () => Promise<GraphData>;
}

export class AgentService {
  private _phase: AgentPhase = 'idle';
  private _plan?: AgentPlan;
  private _diffResult?: DiffResult;
  private _diffEngine = new DiffEngine();
  private _applyService = new ApplyService();

  callbacks: AgentCallbacks = {};

  get phase(): AgentPhase { return this._phase; }
  get plan(): AgentPlan | undefined { return this._plan; }
  get diffResult(): DiffResult | undefined { return this._diffResult; }
  get diffMeta(): DiffMeta | undefined { return this._diffResult?.diffMeta; }
  get applyService(): ApplyService { return this._applyService; }

  // ── Phase management ─────────────────────────────────────

  private _setPhase(phase: AgentPhase): void {
    this._phase = phase;
    this.callbacks.onPhaseChange?.(phase);
  }

  reset(): void {
    this._plan = undefined;
    this._diffResult = undefined;
    this._setPhase('idle');
  }

  // ── 1. PLAN ──────────────────────────────────────────────

  /**
   * Generate a plan from the user request + context.
   * MVP stub: creates a simple plan that lists touched files from context.
   * Replace with real LLM call later.
   */
  async generatePlan(
    userRequest: string,
    context: ContextItem[],
  ): Promise<AgentPlan> {
    this._setPhase('planning');
    this.callbacks.onMessage?.(`Planning: "${userRequest}"…`);

    // MVP stub — derive plan from context items
    const touchedFiles = [...new Set(context.map(c => c.filePath))];
    const planSteps: PlanStep[] = touchedFiles.map((fp, i) => ({
      id: `step-${i}`,
      description: `Modify ${fp}`,
      filePath: fp,
      type: 'modify' as const,
      status: 'pending' as const,
    }));

    if (planSteps.length === 0) {
      // No context — create a placeholder step
      planSteps.push({
        id: 'step-0',
        description: userRequest,
        type: 'modify',
        status: 'pending',
      });
    }

    this._plan = {
      planSteps,
      touchedFiles,
      touchedSymbols: context.map(c => c.snippet.slice(0, 50)),
    };

    this.callbacks.onPlan?.(this._plan);
    this.callbacks.onMessage?.(
      `Plan ready: ${planSteps.length} step(s), ${touchedFiles.length} file(s). Click "Generate Diff" to proceed.`
    );
    return this._plan;
  }

  // ── 2. DIFF ──────────────────────────────────────────────

  /**
   * Generate diff from the current plan.
   * Reads current file contents → creates stub patches → computes graph diff.
   */
  async generateDiff(): Promise<DiffResult | undefined> {
    if (!this._plan) {
      this.callbacks.onMessage?.('No plan available. Generate a plan first.');
      return undefined;
    }

    this._setPhase('diffing');
    this.callbacks.onMessage?.('Computing diff…');

    try {
      // Read current file contents for each touched file
      const patches: FilePatch[] = [];
      for (const fp of this._plan.touchedFiles) {
        try {
          const uri = vscode.Uri.file(fp);
          const doc = await vscode.workspace.openTextDocument(uri);
          const original = doc.getText();

          // MVP stub: patched content = original + comment marker
          // Real implementation will use LLM-generated patches
          const patchedContent = original + '\n// [LogoCode] Modified by agent\n';

          patches.push({ filePath: fp, originalContent: original, patchedContent });
        } catch {
          this.callbacks.onMessage?.(`⚠ Could not read: ${fp}`);
        }
      }

      // Get before/after graphs
      const beforeGraph = await this.callbacks.getGraphData?.() ?? { nodes: [], edges: [] };
      // For MVP, afterGraph is the same as before (real impl would re-analyze temp-patched files)
      const afterGraph = beforeGraph;

      this._diffResult = this._diffEngine.computeDiff(beforeGraph, afterGraph, patches);
      this._setPhase('reviewing');

      this.callbacks.onDiffResult?.(this._diffResult);
      this.callbacks.onMessage?.(
        `Diff ready: ${patches.length} file(s). Review and accept files, then click "Apply Selected".`
      );
      return this._diffResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onMessage?.(`Diff failed: ${msg}`);
      this._setPhase('idle');
      return undefined;
    }
  }

  // ── 3. APPLY ─────────────────────────────────────────────

  /**
   * Apply accepted patches from the current diff result.
   */
  async applyChanges(): Promise<ApplyResult | undefined> {
    if (!this._diffResult) {
      this.callbacks.onMessage?.('No diff result available. Generate a diff first.');
      return undefined;
    }

    this._setPhase('applying');
    this.callbacks.onMessage?.('Applying changes…');

    const result = await this._applyService.applyPatches(
      this._diffResult.patches,
      this._diffResult.diffMeta,
    );

    this.callbacks.onApplyResult?.(result);

    if (result.error) {
      this.callbacks.onMessage?.(`Apply error: ${result.error}`);
    } else {
      this.callbacks.onMessage?.(
        `Applied ${result.applied.length} file(s), skipped ${result.skipped.length}.`
      );
    }

    // Mark applied plan steps
    if (this._plan) {
      for (const step of this._plan.planSteps) {
        if (step.filePath && result.applied.includes(step.filePath)) {
          step.status = 'applied';
        } else if (step.filePath && result.skipped.includes(step.filePath)) {
          step.status = 'rejected';
        }
      }
    }

    this._setPhase('idle');
    return result;
  }
}
