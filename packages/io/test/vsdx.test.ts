import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { parseWorkspace, type Workspace } from '@all-draw/core';
import { importVsdx, isVsdx, importAnyBinary } from '../src';

const bytes = () => new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'flujo-bpmn.vsdx')));
const el = (ws: Workspace, name: string) => Object.values(ws.elements).find(e => e.name === name)!;
const node = (ws: Workspace, name: string) => Object.values(ws.nodes).find(n => n.text === name) ?? Object.values(ws.nodes).find(n => n.elementId !== undefined && n.elementId === el(ws, name)?.id)!;

describe('importVsdx', () => {
  const { workspace: ws, warnings } = importVsdx(bytes());

  it('páginas → vistas (sin la de fondo), con la notación de sus formas y el título del documento', () => {
    expect(() => parseWorkspace(ws)).not.toThrow();
    expect(ws.meta.name).toBe('Pedidos (Visio)');
    expect(Object.values(ws.views).map(v => [v.name, v.notationId])).toEqual([['Flujo', 'flow'], ['BPMN', 'bpmn']]);
    expect(warnings.join('\n')).toMatch(/página de fondo «Fondo»/);
  });

  it('maestros del diagrama de flujo → pack flow (inicio/fin según las conexiones)', () => {
    expect(el(ws, 'Inicio').typeId).toBe('flow:Start');
    expect(el(ws, 'Fin').typeId).toBe('flow:End');
    expect(el(ws, 'Validar solicitud').typeId).toBe('flow:Process');
    expect(el(ws, '¿Correcta?').typeId).toBe('flow:Decision');
    expect(el(ws, 'Informe').typeId).toBe('flow:Document');
  });

  it('pulgadas con la Y hacia arriba → píxeles con la Y hacia abajo; tamaño heredado del maestro', () => {
    // Pin (1.5, 7.5) en una página de 8.5": esquina (1.0, 8.5-7.75=0.75") → (96, 72) px; maestro 1" × 0.5"
    expect(node(ws, 'Inicio')).toMatchObject({ x: 96, y: 72, w: 96, h: 48 });
    expect(node(ws, 'Validar solicitud')).toMatchObject({ x: 264, y: 60, w: 144, h: 72, style: { fill: '#dae8fc' } });
  });

  it('datos de forma → propiedades; grupos → anidamiento relativo; texto suelto → etiqueta', () => {
    expect(el(ws, 'Validar solicitud').props).toEqual({ Responsable: 'Ana', Coste: '12' });
    const group = node(ws, 'Equipo');
    expect(group.visualType).toBe('core:group');
    expect(node(ws, 'Revisor A')).toMatchObject({ parentNodeId: group.id, x: 19, y: 22 });
    expect(el(ws, 'Revisor B & C').typeId).toBe('lib:lib_visio:rect');
    expect(node(ws, 'Nota suelta').visualType).toBe('core:label');
  });

  it('conectores pegados → relaciones con etiqueta, quiebros y línea discontinua', () => {
    const edges = Object.values(ws.edges).filter(e => e.viewId === 'view_visio_1');
    expect(edges).toHaveLength(6);
    const rel = (e: { relationId?: string }) => ws.relations[e.relationId!]!;
    expect(edges.every(e => rel(e).typeId === 'flow:Arrow')).toBe(true);
    expect(edges.map(e => rel(e).name).filter(Boolean).sort()).toEqual(['no', 'sí']);
    const back = edges.find(e => e.fromNodeId === node(ws, 'Corregir').id)!;
    expect(back.toNodeId).toBe(node(ws, 'Validar solicitud').id);
    expect(back.bendpoints).toEqual([{ x: 576, y: 154 }, { x: 408, y: 154 }]);
    expect(edges.find(e => e.toNodeId === node(ws, 'Informe').id)!.style.line).toBe('dashed');
  });

  it('BPMN: eventos, tarea, compuerta, almacén y flujos por el maestro del conector', () => {
    expect(el(ws, 'Pedido').typeId).toBe('bpmn:StartEvent');
    expect(el(ws, 'Revisar pedido').typeId).toBe('bpmn:Task');
    expect(el(ws, '¿Stock?').typeId).toBe('bpmn:ExclusiveGateway');
    expect(el(ws, 'Inventario').typeId).toBe('bpmn:DataStore');
    const types = Object.values(ws.relations).filter(r => r.typeId.startsWith('bpmn:')).map(r => r.typeId).sort();
    expect(types).toEqual(['bpmn:Association', 'bpmn:SequenceFlow', 'bpmn:SequenceFlow', 'bpmn:SequenceFlow']);
  });

  it('avisa de lo que no importa', () => {
    expect(warnings.join('\n')).toMatch(/imágenes y objetos incrustados/);
    expect(warnings.join('\n')).toMatch(/capas de Visio/);
  });
});

describe('errores y detección binaria', () => {
  it('isVsdx y mensajes claros', () => {
    expect(isVsdx(bytes())).toBe(true);
    expect(isVsdx(strToU8('<xml/>'))).toBe(false);
    expect(() => importVsdx(strToU8('no es un zip'))).toThrow(/ZIP válido/);
    expect(() => importVsdx(zipSync({ 'visio/x.xml': strToU8('<a/>') }))).toThrow(/pages\.xml/);
  });

  it('importAnyBinary: vsdx por contenido y texto (UTF-8) para el resto', async () => {
    const r = await importAnyBinary(bytes(), 'pedidos.vsdx');
    expect(r.format).toBe('vsdx');
    expect(r.formatLabel).toBe('Visio (.vsdx)');
    expect(Object.keys(r.workspace.views)).toHaveLength(2);
    const t = await importAnyBinary(strToU8('flowchart TD\n A --> B'), 'x.mmd');
    expect(t.format).toBe('mermaid');
    await expect(importAnyBinary(zipSync({ 'a.txt': strToU8('x') }), 'x.zip')).rejects.toThrow(/ZIP/);
  });
});
