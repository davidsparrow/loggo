/**
 * DependencyExtractor — builds a GraphData structure from AnalysisResult.
 *
 * Ported from integrations/llm-codemap and adapted to our types.
 */

import * as path from 'path';
import {
  GraphNode,
  GraphEdge,
  GraphData,
  NodeType,
  EdgeType,
} from '../types/graph';
import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  ImportInfo,
} from '../types/analyzer';
import { TypeScriptAnalyzer } from './TypeScriptAnalyzer';

export class DependencyExtractor {
  private nodeMap = new Map<string, GraphNode>();
  private edgeMap = new Map<string, GraphEdge>();
  private fileToNodes = new Map<string, string[]>();

  /** Build graph from analysis result */
  async extractGraphData(
    analyzer: TypeScriptAnalyzer,
    result: AnalysisResult,
  ): Promise<GraphData> {
    this.nodeMap.clear();
    this.edgeMap.clear();
    this.fileToNodes.clear();

    // 1. File nodes
    for (const file of result.files) {
      this.addFileNode(file.path);
    }

    // 2. Function nodes
    for (const fn of result.functions) {
      this.addFunctionNode(fn);
    }

    // 3. Class + method nodes
    for (const cls of result.classes) {
      this.addClassNode(cls);
      for (const method of cls.methods) {
        this.addMethodNode(method, cls);
      }
    }

    // 4. Import edges
    for (const imp of result.imports) {
      this.addImportEdges(imp);
    }

    // 5. Inheritance edges
    for (const cls of result.classes) {
      this.addInheritanceEdges(cls);
    }

    // 6. Parent-child (contains) edges
    this.addContainsEdges();

    const graphData: GraphData = {
      nodes: Array.from(this.nodeMap.values()),
      edges: Array.from(this.edgeMap.values()),
    };

    console.log(
      `[LogoCode] Graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`
    );
    return graphData;
  }

  // ── Node creators ──────────────────────────────────────────

  private addFileNode(filePath: string): void {
    const id = `file:${filePath}`;
    if (this.nodeMap.has(id)) { return; }
    this.nodeMap.set(id, {
      id, label: path.basename(filePath), type: NodeType.File, filePath,
      metadata: { fullPath: filePath },
    });
    this.trackFileNode(filePath, id);
  }

  private addFunctionNode(fn: FunctionInfo): void {
    const id = `function:${fn.filePath}:${fn.name}`;
    if (this.nodeMap.has(id)) { return; }
    this.nodeMap.set(id, {
      id, label: fn.name, type: NodeType.Function, filePath: fn.filePath,
      line: fn.line, column: fn.column, parentId: `file:${fn.filePath}`,
      metadata: { isExported: fn.isExported, isAsync: fn.isAsync, parameters: fn.parameters },
    });
    this.trackFileNode(fn.filePath, id);
  }

  private addClassNode(cls: ClassInfo): void {
    const id = `class:${cls.filePath}:${cls.name}`;
    if (this.nodeMap.has(id)) { return; }
    this.nodeMap.set(id, {
      id, label: cls.name, type: NodeType.Class, filePath: cls.filePath,
      line: cls.line, column: cls.column, parentId: `file:${cls.filePath}`,
      metadata: { isExported: cls.isExported, extends: cls.extends, implements: cls.implements },
    });
    this.trackFileNode(cls.filePath, id);
  }

  private addMethodNode(method: { name: string; filePath: string; line: number; column: number }, cls: ClassInfo): void {
    const id = `method:${method.filePath}:${cls.name}.${method.name}`;
    if (this.nodeMap.has(id)) { return; }
    this.nodeMap.set(id, {
      id, label: `${cls.name}.${method.name}`, type: NodeType.Method,
      filePath: method.filePath, line: method.line, column: method.column,
      parentId: `class:${cls.filePath}:${cls.name}`,
    });
  }

  private trackFileNode(filePath: string, nodeId: string): void {
    if (!this.fileToNodes.has(filePath)) { this.fileToNodes.set(filePath, []); }
    this.fileToNodes.get(filePath)!.push(nodeId);
  }

  // ── Edge creators ──────────────────────────────────────────
  // (continued in next section)

  private addImportEdges(imp: ImportInfo): void {
    const sourceFileId = `file:${imp.from}`;
    // Ensure the source file node exists
    if (!this.nodeMap.has(sourceFileId)) {
      this.addFileNode(imp.from);
    }

    for (const name of imp.imports) {
      // Try to find the specific exported symbol
      let targetId: string | undefined;
      for (const [nid, node] of this.nodeMap) {
        if (node.label === name && (node.type === NodeType.Function || node.type === NodeType.Class)) {
          targetId = nid;
          break;
        }
      }

      if (targetId) {
        // Edge to specific symbol
        const edgeId = `import:${sourceFileId}:${targetId}`;
        if (!this.edgeMap.has(edgeId)) {
          this.edgeMap.set(edgeId, {
            id: edgeId, source: sourceFileId, target: targetId,
            type: EdgeType.Import, label: name,
          });
        }
      }
    }
  }

  private addInheritanceEdges(cls: ClassInfo): void {
    const classId = `class:${cls.filePath}:${cls.name}`;

    if (cls.extends) {
      const parentId = this.findNodeByName(cls.extends, NodeType.Class);
      if (parentId) {
        const edgeId = `extends:${classId}:${parentId}`;
        if (!this.edgeMap.has(edgeId)) {
          this.edgeMap.set(edgeId, {
            id: edgeId, source: classId, target: parentId,
            type: EdgeType.Extends, label: 'extends',
          });
        }
      }
    }

    for (const iface of cls.implements) {
      const ifaceId = this.findNodeByName(iface, NodeType.Interface);
      if (ifaceId) {
        const edgeId = `implements:${classId}:${ifaceId}`;
        if (!this.edgeMap.has(edgeId)) {
          this.edgeMap.set(edgeId, {
            id: edgeId, source: classId, target: ifaceId,
            type: EdgeType.Implements, label: 'implements',
          });
        }
      }
    }
  }

  private addContainsEdges(): void {
    for (const [nodeId, node] of this.nodeMap) {
      if (node.parentId && this.nodeMap.has(node.parentId)) {
        const edgeId = `parent:${node.parentId}:${nodeId}`;
        if (!this.edgeMap.has(edgeId)) {
          this.edgeMap.set(edgeId, {
            id: edgeId, source: node.parentId, target: nodeId,
            type: EdgeType.Reference, label: 'contains',
          });
        }
      }
    }
  }

  private findNodeByName(name: string, type: NodeType): string | undefined {
    for (const [nid, node] of this.nodeMap) {
      if (node.label === name && node.type === type) { return nid; }
    }
    return undefined;
  }
}

