/**
 * Tipos públicos de `@all-draw/codegen`. La interfaz (UI) se escribe contra ellos: no cambiar sin avisar.
 */
import type { Workspace } from '@all-draw/core';

export type CodeLanguage = 'typescript' | 'java' | 'sql' | 'markdown' | 'yaml' | 'text';

export interface CodeFile { path: string; content: string; language: CodeLanguage }

/** Aviso traducible: `key` es el texto en español con `{var}` (convenio de @all-draw/i18n); `vars` sus valores. */
export interface CodegenWarning { key: string; vars?: Record<string, string | number> }

export interface CodegenResult { files: CodeFile[]; warnings: CodegenWarning[] }

export interface CodegenOptions { viewId?: string }

export type GeneratorId =
  | 'uml-typescript' | 'uml-java' | 'er-postgres' | 'er-sqlite'
  | 'statechart-xstate' | 'statechart-table' | 'openapi' | 'structurizr-dsl';

export interface Generator {
  id: GeneratorId;
  /** Nombre corto en español (la UI lo traduce con t()). */
  label: string;
  /** Una frase en español. */
  description: string;
  /** ¿Tiene sentido para esta vista (o, sin vista, para el espacio)? */
  applies(ws: Workspace, viewId?: string | null): boolean;
  generate(ws: Workspace, opts?: CodegenOptions): CodegenResult;
}
