/**
 * El layout automático por notación usa los ids reales de los packs (`flow`, `uml`…). Antes se usaban `flowchart` y
 * `uml-class`, que no existen, y esas vistas caían en `stress`. Se importan los packs de verdad para que no vuelva a pasar.
 */
import { describe, it, expect } from 'vitest';
import type { NotationPack } from '@all-draw/core';
import { AUTO_LAYOUT, autoLayoutDefaults } from '../src';
import { ARCHIMATE_PACK } from '../../notations/archimate/src';
import { BPMN_PACK } from '../../notations/bpmn/src';
import { C4_PACK } from '../../notations/c4/src';
import { CATALOG_PACK } from '../../notations/catalog/src';
import { DFD_PACK } from '../../notations/dfd/src';
import { ER_PACK } from '../../notations/er/src';
import { FLOWCHART_PACK } from '../../notations/flowchart/src';
import { FREEFORM_PACK } from '../../notations/freeform/src';
import { GRID_PACK } from '../../notations/grid/src';
import { MINDMAP_PACK } from '../../notations/mindmap/src';
import { SEQUENCE_PACK } from '../../notations/sequence/src';
import { STATECHART_PACK } from '../../notations/statechart/src';
import { UML_CLASS_PACK } from '../../notations/uml-class/src';
import { USECASE_PACK } from '../../notations/usecase/src';
import { COMPONENT_PACK } from '../../notations/component/src';
import { DEPLOYMENT_PACK } from '../../notations/deployment/src';
import { ACTIVITY_PACK } from '../../notations/activity/src';
import { GANTT_PACK } from '../../notations/gantt/src';
import { DDD_PACK } from '../../notations/ddd/src';

const PACKS: NotationPack[] = [ARCHIMATE_PACK, BPMN_PACK, C4_PACK, CATALOG_PACK, DFD_PACK, ER_PACK, FLOWCHART_PACK, FREEFORM_PACK, GRID_PACK, MINDMAP_PACK, SEQUENCE_PACK, STATECHART_PACK, UML_CLASS_PACK, USECASE_PACK, COMPONENT_PACK, DEPLOYMENT_PACK, ACTIVITY_PACK, GANTT_PACK, DDD_PACK];
const ids = PACKS.map(p => p.id);

describe('autoLayoutDefaults: ids de los packs reales', () => {
  it('cada pack tiene su entrada y no hay entradas con ids que no existen', () => {
    expect(ids).toContain('flow');
    expect(ids).toContain('uml');
    expect(ids.filter(id => !(id in AUTO_LAYOUT))).toEqual([]);
    expect(Object.keys(AUTO_LAYOUT).filter(id => !ids.includes(id))).toEqual([]);
  });

  it('diagrama de flujo y clases UML van por capas de arriba abajo (no caen en stress)', () => {
    expect(autoLayoutDefaults(FLOWCHART_PACK.id)).toEqual({ algorithm: 'layered', direction: 'DOWN' });
    expect(autoLayoutDefaults(UML_CLASS_PACK.id)).toEqual({ algorithm: 'layered', direction: 'DOWN' });
    expect(autoLayoutDefaults(DFD_PACK.id).algorithm).toBe('layered');
    expect(autoLayoutDefaults(MINDMAP_PACK.id).algorithm).toBe('mrtree');
    // Notaciones nuevas: actividad de arriba abajo; casos de uso y Gantt de izquierda a derecha
    expect(autoLayoutDefaults(ACTIVITY_PACK.id)).toEqual({ algorithm: 'layered', direction: 'DOWN' });
    expect(autoLayoutDefaults(USECASE_PACK.id)).toEqual({ algorithm: 'layered', direction: 'RIGHT' });
    expect(autoLayoutDefaults(GANTT_PACK.id).direction).toBe('RIGHT');
    for (const p of [COMPONENT_PACK, DEPLOYMENT_PACK, DDD_PACK]) expect(autoLayoutDefaults(p.id)).toEqual({ algorithm: 'layered', direction: 'DOWN' });
  });

  it('solo las notaciones sin dirección propia usan stress; una desconocida, como freeform', () => {
    const stress = ids.filter(id => autoLayoutDefaults(id).algorithm === 'stress').sort();
    expect(stress).toEqual(['catalog', 'freeform', 'grid']);
    expect(autoLayoutDefaults('flowchart')).toEqual(autoLayoutDefaults('freeform'));
    expect(autoLayoutDefaults('toString')).toEqual(autoLayoutDefaults('freeform'));
    // Devuelve una copia: modificarla no cambia la tabla
    const d = autoLayoutDefaults('bpmn'); d.direction = 'LEFT';
    expect(autoLayoutDefaults('bpmn').direction).toBe('RIGHT');
  });
});
