import { describe, it, expect } from 'vitest';
import { importStructurizr, exportStructurizr, type StructurizrWorkspace } from '../src';

const FIXTURE: StructurizrWorkspace = {
  id: 1, name: 'Banca', description: 'Ejemplo',
  model: {
    people: [{ id: '1', name: 'Cliente', description: 'Usuario', location: 'External', tags: 'Element,Person', relationships: [{ id: '10', sourceId: '1', destinationId: '2', description: 'Usa', technology: 'HTTPS', tags: 'Relationship' }] }],
    softwareSystems: [
      { id: '2', name: 'Banca online', description: 'Sistema', tags: 'Element,Software System', properties: { owner: 'equipo' },
        containers: [
          { id: '3', name: 'Web', technology: 'React', tags: 'Element,Container', relationships: [{ id: '11', sourceId: '3', destinationId: '4', description: 'Lee', technology: 'JDBC' }],
            components: [{ id: '5', name: 'Login', technology: 'TS', relationships: [{ id: '12', sourceId: '5', destinationId: '4', description: 'consulta' }] }] },
          { id: '4', name: 'BD', technology: 'Postgres', tags: 'Element,Container,Database' },
        ] },
      { id: '6', name: 'Correo', location: 'External', relationships: [{ id: '13', sourceId: '6', destinationId: '99', description: 'rota' }] },
    ],
    deploymentNodes: [{ id: '20', name: 'AWS', technology: 'Cloud', environment: 'Prod', instances: '1',
      children: [{ id: '21', name: 'EC2', technology: 'Linux', environment: 'Prod', containerInstances: [{ id: '30', containerId: '3', environment: 'Prod', instanceId: 1, relationships: [{ id: '31', sourceId: '30', destinationId: '32', description: 'Lee', linkedRelationshipId: '11' }] }] }],
      containerInstances: [{ id: '32', containerId: '4', environment: 'Prod', instanceId: 1 }],
    }],
  },
  views: {
    systemContextViews: [{ key: 'ctx', title: 'Contexto', softwareSystemId: '2', elements: [{ id: '1', x: 100, y: 100 }, { id: '2', x: 600, y: 100 }], relationships: [{ id: '10', vertices: [{ x: 400, y: 50 }], routing: 'Orthogonal' }] }],
    containerViews: [{ key: 'cont', softwareSystemId: '2', elements: [{ id: '1', x: 0, y: 0 }, { id: '3', x: 500, y: 0 }, { id: '4', x: 500, y: 400 }] }],
    componentViews: [{ key: 'comp', containerId: '3', elements: [{ id: '5', x: 0, y: 0 }, { id: '4', x: 500, y: 0 }], relationships: [{ id: '12' }] }],
    deploymentViews: [{ key: 'dep', environment: 'Prod', elements: [{ id: '20', x: 0, y: 0 }, { id: '21', x: 50, y: 80 }, { id: '30', x: 100, y: 160 }, { id: '32', x: 600, y: 80 }], relationships: [{ id: '31' }] }],
    dynamicViews: [{ key: 'dyn' }],
  },
};

describe('importStructurizr', () => {
  const { workspace: ws, warnings } = importStructurizr(FIXTURE);

  it('crea elementos c4 con tipo, externo, tecnología, clase, etiquetas y propiedades', () => {
    expect(ws.elements['1']).toMatchObject({ typeId: 'c4:Person', fields: { external: true }, tags: [] });
    expect(ws.elements['2']).toMatchObject({ typeId: 'c4:SoftwareSystem', fields: { external: false }, props: { owner: 'equipo' } });
    expect(ws.elements['3']).toMatchObject({ typeId: 'c4:Container', fields: { technology: 'React' } });
    expect(ws.elements['4']).toMatchObject({ typeId: 'c4:Container', fields: { technology: 'Postgres', kind: 'database' }, tags: [] });
    expect(ws.elements['5']).toMatchObject({ typeId: 'c4:Component', fields: { technology: 'TS' } });
    expect(ws.elements['21']).toMatchObject({ typeId: 'c4:DeploymentNode', props: { environment: 'Prod' } });
  });

  it('crea relaciones y resuelve las de instancias', () => {
    expect(ws.relations['10']).toMatchObject({ typeId: 'c4:Relationship', name: 'Usa', fields: { technology: 'HTTPS' }, from: { elementId: '1' }, to: { elementId: '2' } });
    expect(ws.relations['31']).toBeUndefined();
    expect(ws.relations['13']).toBeUndefined();
    expect(warnings.some(w => w.includes('13'))).toBe(true);
    expect(warnings.some(w => w.includes('dinámica'))).toBe(true);
  });

  it('crea vistas C4 con viewpoint, raíz, nodos, anidamiento y aristas', () => {
    expect(ws.views['ctx']).toMatchObject({ notationId: 'c4', viewpointId: 'context', rootElementId: '2', name: 'Contexto' });
    expect(ws.views['comp']).toMatchObject({ viewpointId: 'component', rootElementId: '3' });
    expect(ws.views['dep']).toMatchObject({ viewpointId: 'deployment', props: { environment: 'Prod' } });
    expect(ws.nodes['ctx:1']).toMatchObject({ elementId: '1', x: 100, y: 100 });
    expect(ws.edges['ctx:10']).toMatchObject({ relationId: '10', fromNodeId: 'ctx:1', toNodeId: 'ctx:2', bendpoints: [{ x: 400, y: 50 }], style: { router: 'orthogonal' }, label: 'Usa' });
    // sin lista de relaciones: se dibujan todas las del modelo entre los presentes
    expect(ws.edges['cont:11']).toBeDefined();
    // despliegue: la instancia 30 es un nodo del contenedor 3 dentro de EC2, que está dentro de AWS
    expect(ws.nodes['dep:30']).toMatchObject({ elementId: '3', parentNodeId: 'dep:21', meta: { instanceId: '30' } });
    expect(ws.nodes['dep:21']).toMatchObject({ parentNodeId: 'dep:20' });
    expect(ws.edges['dep:31']).toMatchObject({ relationId: '11', fromNodeId: 'dep:30', toNodeId: 'dep:32' });
    // el nodo de despliegue abarca a sus hijos
    const aws = ws.nodes['dep:20']!, ec2 = ws.nodes['dep:21']!;
    expect(ec2.x + ec2.w).toBeLessThanOrEqual(aws.w);
  });
});

describe('exportStructurizr', () => {
  it('ida y vuelta conserva jerarquía, relaciones y vistas', () => {
    const a = importStructurizr(FIXTURE).workspace;
    const { data, warnings } = exportStructurizr(a);
    expect(warnings).toEqual([]);
    expect(data.model!.people!.map(p => p.id)).toEqual(['1']);
    expect(data.model!.people![0]!.location).toBe('External');
    const sys = data.model!.softwareSystems!.find(s => s.id === '2')!;
    expect(sys.containers!.map(c => c.id).sort()).toEqual(['3', '4']);
    expect(sys.containers!.find(c => c.id === '3')!.components!.map(c => c.id)).toEqual(['5']);
    expect(sys.containers!.find(c => c.id === '4')!.tags).toContain('database');
    expect(data.model!.deploymentNodes![0]!.children![0]!.containerInstances![0]).toMatchObject({ id: '30', containerId: '3' });
    expect(data.views!.systemContextViews![0]).toMatchObject({ key: 'ctx', softwareSystemId: '2' });
    expect(data.views!.componentViews![0]).toMatchObject({ key: 'comp', containerId: '3' });
    expect(data.views!.deploymentViews![0]!.elements!.find(e => e.id === '30')).toMatchObject({ x: 100, y: 160 });
    const b = importStructurizr(data).workspace;
    expect(Object.keys(b.elements).sort()).toEqual(Object.keys(a.elements).sort());
    expect(Object.keys(b.relations).sort()).toEqual(Object.keys(a.relations).sort());
    expect(Object.keys(b.nodes).sort()).toEqual(Object.keys(a.nodes).sort());
    expect(b.elements).toEqual(a.elements);
    expect(b.nodes['dep:30']).toEqual(a.nodes['dep:30']);
    expect(b.edges['ctx:10']).toEqual(a.edges['ctx:10']);
  });

  it('avisa de lo que no es C4 y de contenedores sin sistema', () => {
    const a = importStructurizr(FIXTURE).workspace;
    a.elements['x'] = { id: 'x', typeId: 'archimate:BusinessActor', name: 'Actor', doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [] };
    a.elements['c9'] = { id: 'c9', typeId: 'c4:Container', name: 'Suelto', doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [] };
    const { data, warnings } = exportStructurizr(a);
    expect(warnings.some(w => w.includes('Actor'))).toBe(true);
    expect(warnings.some(w => w.includes('Suelto'))).toBe(true);
    expect(data.model!.softwareSystems!.find(s => s.id === 'sin-sistema')!.containers![0]!.id).toBe('c9');
  });
});
