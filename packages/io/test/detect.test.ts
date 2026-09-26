import { describe, it, expect } from 'vitest';
import { detectFormat, importAny, exportWorkspace, importMermaid } from '../src';

describe('detectFormat', () => {
  it('reconoce cada formato por contenido', () => {
    expect(detectFormat('<?xml version="1.0"?><archimate:model xmlns:archimate="http://www.archimatetool.com/archimate"/>')).toBe('archimate');
    expect(detectFormat('<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"/>')).toBe('oef');
    expect(detectFormat('<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"/>')).toBe('bpmn');
    expect(detectFormat('<svg/>')).toBe('unknown');
    expect(detectFormat('%% hola\nflowchart LR\n A --> B')).toBe('mermaid');
    expect(detectFormat('stateDiagram-v2\n [*] --> A')).toBe('mermaid');
    expect(detectFormat('{"openapi":"3.0.0","paths":{}}')).toBe('openapi');
    expect(detectFormat('openapi: 3.0.0\ninfo:\n  title: x\npaths: {}')).toBe('openapi');
    expect(detectFormat('{"app":"diagramador","version":1,"libraries":[],"diagrams":[]}')).toBe('drawer');
    expect(detectFormat('{"model":{"softwareSystems":[]},"views":{}}')).toBe('structurizr');
    expect(detectFormat('{"id":"m","initial":"a","states":{"a":{}}}')).toBe('xstate');
    expect(detectFormat(exportWorkspace(importMermaid('flowchart TD\n A').workspace))).toBe('alldraw');
    expect(detectFormat('hola')).toBe('unknown');
    expect(detectFormat('{no json')).toBe('unknown');
  });

  it('usa la extensión como pista', () => {
    expect(detectFormat('', 'x.drawer')).toBe('drawer');
    expect(detectFormat('', 'x.archimate')).toBe('archimate');
    expect(detectFormat('graph TD\n a', 'x.mmd')).toBe('mermaid');
    expect(detectFormat('<x/>', 'proceso.bpmn')).toBe('bpmn');
  });
});

describe('importAny', () => {
  it('delega en el importador adecuado y devuelve el formato', async () => {
    const m = await importAny('flowchart TD\n A --> B');
    expect(m.format).toBe('mermaid');
    expect(Object.keys(m.workspace.elements)).toEqual(['A', 'B']);
    const x = await importAny('{"id":"m","initial":"a","states":{"a":{}}}');
    expect(x.format).toBe('xstate');
    const o = await importAny('{"openapi":"3.0.0","info":{"title":"T"},"paths":{}}', 'api.json');
    expect(o.format).toBe('openapi');
    const a = await importAny(exportWorkspace(m.workspace));
    expect(a.format).toBe('alldraw');
    await expect(importAny('hola')).rejects.toThrow(/No se reconoce/);
  });
});
