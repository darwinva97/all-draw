import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { DEPLOYMENT_PACK, COMMUNICATION, DEPLOY, MANIFESTATION, DEPENDENCY } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(DEPLOYMENT_PACK);
const T = (n: string) => `deployment:${n}`;

describe('pack deployment', () => {
  it('id = prefijo; tipos y relaciones válidos y documentados', () => {
    expect(DEPLOYMENT_PACK.id).toBe('deployment');
    expect(DEPLOYMENT_PACK.elementTypes.map(t => t.id)).toEqual(['Node', 'Device', 'ExecutionEnvironment', 'Artifact', 'DeploymentSpecification', 'Component'].map(T));
    expect(DEPLOYMENT_PACK.relationTypes.map(t => t.id)).toEqual([COMMUNICATION, DEPLOY, MANIFESTATION, DEPENDENCY]);
    for (const t of [...DEPLOYMENT_PACK.elementTypes, ...DEPLOYMENT_PACK.relationTypes]) expect(t.doc, t.id).toBeTruthy();
    for (const t of DEPLOYMENT_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of DEPLOYMENT_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
  });

  it('nodos contenedores con estereotipo; «deploy» y «manifest» discontinuas', () => {
    const r = reg();
    for (const n of ['Node', 'Device', 'ExecutionEnvironment']) expect(r.elementType(T(n))?.container).toBe(true);
    expect(r.elementType(T('Device'))?.meta?.stereotypeDefault).toBe('device');
    expect(r.relationType(DEPLOY)).toMatchObject({ line: 'dashed', meta: { keyword: '«deploy»' } });
    expect(r.relationType(MANIFESTATION)).toMatchObject({ line: 'dashed', meta: { keyword: '«manifest»' } });
    expect(r.relationType(COMMUNICATION)).toMatchObject({ line: 'solid', targetHead: 'none' });
    expect(r.fieldsOf(T('DeploymentSpecification')).find(f => f.key === 'properties')?.kind).toBe('keyvalue');
  });

  it('matriz: comunicación entre nodos, despliegue artefacto → nodo, manifestación artefacto → componente', () => {
    const r = reg();
    expect(r.allowedRelations(T('Device'), T('ExecutionEnvironment'))).toContain(COMMUNICATION);
    expect(r.allowedRelations(T('Artifact'), T('Node'))).toContain(DEPLOY);
    expect(r.isValidRelation(T('Node'), T('Artifact'), DEPLOY)).toBe(false);
    expect(r.allowedRelations(T('Artifact'), T('Component'))).toContain(MANIFESTATION);
    expect(r.allowedRelations(T('DeploymentSpecification'), T('Artifact'))).toContain(DEPENDENCY);
    expect(r.isValidRelation(T('Artifact'), T('Artifact'), COMMUNICATION)).toBe(false);
  });

  it('anidamiento: nodo ⊃ entorno ⊃ artefacto', () => {
    const nest = DEPLOYMENT_PACK.nesting!;
    expect(nest.some(n => n.parent === 'Node' && n.child === 'ExecutionEnvironment')).toBe(true);
    expect(nest.some(n => n.parent === 'ExecutionEnvironment' && n.child === 'Artifact')).toBe(true);
    expect(nest.some(n => n.parent === 'Artifact')).toBe(false);
  });
});
