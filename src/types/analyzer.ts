/**
 * Code analyzer types — mirrors llm-codemap analyzer types.
 */

/** File info from workspace analysis */
export interface FileInfo {
  path: string;
  content: string;
  sourceFile?: unknown;
}

/** Function info */
export interface FunctionInfo {
  name: string;
  filePath: string;
  line: number;
  column: number;
  isExported: boolean;
  isAsync: boolean;
  parameters: string[];
  returnType?: string;
}

/** Class info */
export interface ClassInfo {
  name: string;
  filePath: string;
  line: number;
  column: number;
  isExported: boolean;
  extends?: string;
  implements: string[];
  methods: MethodInfo[];
  properties: PropertyInfo[];
}

/** Method info */
export interface MethodInfo {
  name: string;
  filePath: string;
  line: number;
  column: number;
  isPublic: boolean;
  isStatic: boolean;
  isAsync: boolean;
  parameters: string[];
  returnType?: string;
}

/** Property info */
export interface PropertyInfo {
  name: string;
  filePath: string;
  line: number;
  column: number;
  type?: string;
  isPublic: boolean;
  isStatic: boolean;
}

/** Import info */
export interface ImportInfo {
  from: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

/** Export info */
export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'namespace';
  filePath: string;
  line: number;
  column: number;
}

/** Full analysis result */
export interface AnalysisResult {
  files: FileInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

