/**
 * TypeScriptAnalyzer — analyses workspace TS/JS files using the TypeScript Compiler API.
 *
 * Ported from integrations/llm-codemap and adapted to our type definitions.
 */

import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  FileInfo,
  FunctionInfo,
  ClassInfo,
  MethodInfo,
  PropertyInfo,
  ImportInfo,
  ExportInfo,
  AnalysisResult,
} from '../types/analyzer';
import {
  findFiles,
  readFileContent,
  isTypeScriptOrJavaScriptFile,
  shouldExcludeFile,
} from '../utils/fileUtils';
import { normalizePath } from '../utils/pathUtils';

export class TypeScriptAnalyzer {
  private program?: ts.Program;
  private sourceFiles: Map<string, ts.SourceFile> = new Map();
  private workspacePath?: string;

  /** Analyse the workspace and return structured results */
  async analyzeWorkspace(workspacePath?: string, filePattern?: string): Promise<AnalysisResult> {
    this.workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!this.workspacePath) {
      throw new Error('Workspace path is not available');
    }

    const pattern = filePattern || '**/*.{ts,tsx,js,jsx}';
    console.log(`[LogoCode] Searching files: ${pattern}`);
    const uris = await findFiles(pattern);
    console.log(`[LogoCode] Found ${uris.length} files`);

    // Filter to TS/JS and read content
    const fileInfos: FileInfo[] = [];
    for (const uri of uris) {
      if (shouldExcludeFile(uri.fsPath)) { continue; }
      if (!isTypeScriptOrJavaScriptFile(uri.fsPath)) { continue; }
      try {
        const content = await readFileContent(uri);
        fileInfos.push({ path: uri.fsPath, content });
      } catch { /* skip unreadable files */ }
    }

    console.log(`[LogoCode] Filtered to ${fileInfos.length} TS/JS files`);

    // Create TypeScript Program
    const filePaths = fileInfos.map(f => f.path);
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
      checkJs: false,
      skipLibCheck: true,
    };

    this.program = ts.createProgram(filePaths, compilerOptions);

    // Analyse each file
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    for (const fileInfo of fileInfos) {
      const sourceFile = this.program.getSourceFile(fileInfo.path);
      if (!sourceFile) { continue; }
      fileInfo.sourceFile = sourceFile;
      this.sourceFiles.set(fileInfo.path, sourceFile);
      try {
        this.analyzeSourceFile(sourceFile, fileInfo.path, functions, classes, imports, exports);
      } catch (e) {
        console.warn(`[LogoCode] Failed to analyze ${fileInfo.path}: ${e}`);
      }
    }

    console.log(
      `[LogoCode] Analysis: ${functions.length} fns, ${classes.length} classes, ${imports.length} imports, ${exports.length} exports`
    );
    return { files: fileInfos, functions, classes, imports, exports };
  }

  /** Get a cached SourceFile */
  getSourceFile(filePath: string): ts.SourceFile | undefined {
    return this.sourceFiles.get(filePath);
  }

  // ── Private helpers ────────────────────────────────────────

  private analyzeSourceFile(
    sourceFile: ts.SourceFile,
    filePath: string,
    functions: FunctionInfo[],
    classes: ClassInfo[],
    imports: ImportInfo[],
    exports: ExportInfo[],
  ): void {
    const visit = (node: ts.Node) => {
      try {
        this.visitNode(node, sourceFile, filePath, functions, classes, imports, exports);
      } catch { /* continue on error */ }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  private visitNode(
    node: ts.Node,
    sf: ts.SourceFile,
    fp: string,
    fns: FunctionInfo[],
    cls: ClassInfo[],
    imps: ImportInfo[],
    exps: ExportInfo[],
  ): void {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const info = this.extractFunction(node, sf, fp);
      if (info) { fns.push(info); }
    }

    // Arrow / function expressions assigned to variables
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          const info = this.extractVarFunc(decl, decl.initializer, sf, fp);
          if (info) { fns.push(info); }
        }
      }
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const info = this.extractClass(node, sf, fp);
      if (info) { cls.push(info); }
    }

    // Imports
    if (ts.isImportDeclaration(node)) {
      const info = this.extractImport(node, fp);
      if (info) { imps.push(info); }
    }

    // Export declarations
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      exps.push(...this.extractExports(node, sf, fp));
    }

    // Named export keyword on functions / classes
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node) && node.name?.text) {
        const pos = this.getPos(node, sf);
        exps.push({ name: node.name.text, type: 'named', filePath: fp, line: pos.line + 1, column: pos.character + 1 });
      } else if (ts.isClassDeclaration(node) && node.name?.text) {
        const pos = this.getPos(node, sf);
        exps.push({ name: node.name.text, type: 'named', filePath: fp, line: pos.line + 1, column: pos.character + 1 });
      }
    }
  }

  // ── Extractors ─────────────────────────────────────────────

  private extractFunction(node: ts.FunctionDeclaration, sf: ts.SourceFile, fp: string): FunctionInfo | null {
    if (!node.name?.text) { return null; }
    const pos = this.getPos(node, sf);
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return {
      name: node.name.text, filePath: fp,
      line: pos.line + 1, column: pos.character + 1,
      isExported: mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false,
      isAsync: mods?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
      parameters: this.paramNames(node.parameters),
      returnType: node.type ? this.typeText(node.type, sf) : undefined,
    };
  }

  private extractVarFunc(decl: ts.VariableDeclaration, init: ts.ArrowFunction | ts.FunctionExpression, sf: ts.SourceFile, fp: string): FunctionInfo | null {
    if (!ts.isIdentifier(decl.name) || !decl.name.text) { return null; }
    const pos = this.getPos(decl, sf);
    return {
      name: decl.name.text, filePath: fp,
      line: pos.line + 1, column: pos.character + 1,
      isExported: false,
      isAsync: init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
      parameters: this.paramNames(init.parameters),
      returnType: init.type ? this.typeText(init.type, sf) : undefined,
    };
  }

  private extractClass(node: ts.ClassDeclaration, sf: ts.SourceFile, fp: string): ClassInfo | null {
    if (!node.name?.text) { return null; }
    const pos = this.getPos(node, sf);
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name) && member.name.text) {
        const mPos = this.getPos(member, sf);
        const mMods = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
        methods.push({
          name: member.name.text, filePath: fp,
          line: mPos.line + 1, column: mPos.character + 1,
          isPublic: !mMods?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword),
          isStatic: mMods?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false,
          isAsync: mMods?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
          parameters: this.paramNames(member.parameters),
          returnType: member.type ? this.typeText(member.type, sf) : undefined,
        });
      }
      if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name) && member.name.text) {
        const pPos = this.getPos(member, sf);
        const pMods = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
        properties.push({
          name: member.name.text, filePath: fp,
          line: pPos.line + 1, column: pPos.character + 1,
          type: member.type ? this.typeText(member.type, sf) : undefined,
          isPublic: !pMods?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword),
          isStatic: pMods?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false,
        });
      }
    }

    const extendsClause = node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword);
    const extendsName = extendsClause?.types[0]?.expression;

    return {
      name: node.name.text, filePath: fp,
      line: pos.line + 1, column: pos.character + 1,
      isExported: mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false,
      extends: extendsName && ts.isIdentifier(extendsName) ? extendsName.text : undefined,
      implements: node.heritageClauses
        ?.find(h => h.token === ts.SyntaxKind.ImplementsKeyword)
        ?.types.map(t => ts.isIdentifier(t.expression) ? t.expression.text : '')
        .filter(Boolean) || [],
      methods,
      properties,
    };
  }

  private extractImport(node: ts.ImportDeclaration, fp: string): ImportInfo | null {
    const spec = node.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec) || !spec.text) { return null; }

    const from = spec.text;
    const names: string[] = [];
    let isDefault = false;
    let isNamespace = false;

    if (node.importClause) {
      if (node.importClause.name?.text) {
        names.push(node.importClause.name.text);
        isDefault = true;
      }
      const nb = node.importClause.namedBindings;
      if (nb) {
        if (ts.isNamespaceImport(nb) && nb.name?.text) {
          names.push(nb.name.text);
          isNamespace = true;
        } else if (ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            if (el.name?.text) { names.push(el.name.text); }
          }
        }
      }
    }

    // Resolve relative paths
    let resolvedPath = from;
    if (from.startsWith('.')) {
      const baseDir = path.dirname(fp);
      resolvedPath = normalizePath(from, baseDir);
      if (!fs.existsSync(resolvedPath)) {
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolvedPath + ext)) { resolvedPath = resolvedPath + ext; break; }
        }
      }
    }

    return { from: resolvedPath, imports: names, isDefault, isNamespace };
  }

  private extractExports(node: ts.Node, sf: ts.SourceFile, fp: string): ExportInfo[] {
    const result: ExportInfo[] = [];
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        if (el.name?.text) {
          const pos = this.getPos(node, sf);
          result.push({ name: el.name.text, type: 'named', filePath: fp, line: pos.line + 1, column: pos.character + 1 });
        }
      }
    }
    if (ts.isExportAssignment(node)) {
      const pos = this.getPos(node, sf);
      result.push({ name: 'default', type: 'default', filePath: fp, line: pos.line + 1, column: pos.character + 1 });
    }
    return result;
  }

  private paramNames(params: ts.NodeArray<ts.ParameterDeclaration>): string[] {
    return params
      .map(p => ts.isIdentifier(p.name) && p.name.text ? p.name.text : '')
      .filter(Boolean);
  }

  private getPos(node: ts.Node, sf: ts.SourceFile): { line: number; character: number } {
    try {
      const start = node.pos >= 0 ? node.pos : 0;
      if (start >= sf.text.length) { return { line: 0, character: 0 }; }
      return sf.getLineAndCharacterOfPosition(start);
    } catch { return { line: 0, character: 0 }; }
  }

  private typeText(t: ts.TypeNode, sf: ts.SourceFile): string {
    return ts.createPrinter().printNode(ts.EmitHint.Unspecified, t, sf);
  }
}

