import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { importArchimate, exportArchimate, ARCHIMATE_PROFILES_LIB } from '../src';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Prueba" id="m1" version="5.0.0">
  <folder name="Strategy" id="f-strategy" type="strategy"/>
  <folder name="Business" id="f-business" type="business">
    <folder name="Actores" id="f-actores">
      <element xsi:type="archimate:BusinessActor" name="Cliente" id="e-cliente" profiles="p-vip">
        <documentation>Quien compra</documentation>
        <property key="owner" value="ventas"/>
      </element>
    </folder>
    <element xsi:type="archimate:BusinessProcess" name="Vender" id="e-vender"/>
    <element xsi:type="archimate:BusinessObject" name="Pedido" id="e-pedido"/>
  </folder>
  <folder name="Application" id="f-app" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="CRM" id="e-crm"/>
    <element xsi:type="archimate:ApplicationService" name="Servicio CRM" id="e-svc"/>
  </folder>
  <folder name="Other" id="f-other" type="other">
    <element xsi:type="archimate:Junction" name="J" id="e-j" type="or"/>
    <element xsi:type="archimate:Marciano" name="Raro" id="e-raro"/>
  </folder>
  <folder name="Relations" id="f-rel" type="relations">
    <element xsi:type="archimate:AssignmentRelationship" id="r-asg" source="e-cliente" target="e-vender"/>
    <element xsi:type="archimate:AccessRelationship" id="r-acc" source="e-vender" target="e-pedido" accessType="1"/>
    <element xsi:type="archimate:ServingRelationship" id="r-srv" source="e-svc" target="e-vender"/>
    <element xsi:type="archimate:RealizationRelationship" id="r-rea" source="e-crm" target="e-svc"/>
    <element xsi:type="archimate:AssociationRelationship" id="r-aso" source="e-pedido" target="r-srv" directed="true"/>
    <element xsi:type="archimate:InfluenceRelationship" id="r-inf" source="e-crm" target="e-cliente" strength="++"/>
    <element xsi:type="archimate:FlowRelationship" id="r-rota" source="e-crm" target="e-nadie"/>
  </folder>
  <folder name="Views" id="f-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="Vista 1" id="v1" viewpoint="layered">
      <child xsi:type="archimate:Group" id="g1" name="Negocio" fillColor="#dafecb">
        <bounds x="100" y="100" width="400" height="200"/>
        <child xsi:type="archimate:DiagramObject" id="n-cliente" archimateElement="e-cliente">
          <bounds x="20" y="40" width="120" height="55"/>
          <sourceConnection xsi:type="archimate:Connection" id="c1" source="n-cliente" target="n-vender" archimateRelationship="r-asg">
            <bendpoint startX="60" startY="0" endX="-80" endY="0"/>
          </sourceConnection>
        </child>
        <child xsi:type="archimate:DiagramObject" id="n-vender" targetConnections="c1" archimateElement="e-vender" fillColor="#ffff80" type="1">
          <bounds x="200" y="40" width="120" height="55"/>
        </child>
      </child>
      <child xsi:type="archimate:Note" id="nota1" textAlignment="1">
        <bounds x="600" y="100" width="185" height="80"/>
        <content>Una nota</content>
        <sourceConnection xsi:type="archimate:Connection" id="c-nota" source="nota1" target="n-cliente"/>
      </child>
      <child xsi:type="archimate:DiagramModelReference" id="ref1" model="v2">
        <bounds x="600" y="300" width="120" height="55"/>
      </child>
      <property key="estado" value="borrador"/>
    </element>
    <element xsi:type="archimate:ArchimateDiagramModel" name="Vista 2" id="v2">
      <child xsi:type="archimate:DiagramObject" id="n-crm" archimateElement="e-crm">
        <bounds x="10" y="10"/>
      </child>
    </element>
    <element xsi:type="archimate:SketchModel" name="Boceto" id="sk1"/>
  </folder>
  <profile name="VIP" id="p-vip" conceptType="BusinessActor"/>
  <purpose>Modelo de prueba</purpose>
</archimate:model>`;

describe('importArchimate', () => {
  const { workspace: ws, warnings } = importArchimate(FIXTURE);

  it('lee elementos con tipo, documentación, propiedades, perfiles y carpeta', () => {
    const c = ws.elements['e-cliente']!;
    expect(c.typeId).toBe('archimate:BusinessActor');
    expect(c.doc).toBe('Quien compra');
    expect(c.props).toEqual({ owner: 'ventas' });
    expect(c.profiles).toEqual(['p-vip']);
    expect(c.features.archiFolder).toBe('Actores');
    expect(ws.elements['e-vender']!.features.archiFolder).toBeUndefined();
    expect(ws.elements['e-j']!.fields.junctionType).toBe('or');
    expect(ws.libraries[ARCHIMATE_PROFILES_LIB]!.elementTypes[0]).toMatchObject({ id: 'p-vip', name: 'VIP', extends: 'archimate:BusinessActor' });
    expect(ws.meta.name).toBe('Prueba');
    expect(ws.meta.description).toBe('Modelo de prueba');
  });

  it('omite tipos desconocidos, bocetos y relaciones rotas con aviso', () => {
    expect(ws.elements['e-raro']).toBeUndefined();
    expect(ws.relations['r-rota']).toBeUndefined();
    expect(ws.views['sk1']).toBeUndefined();
    expect(warnings.some(w => w.includes('Marciano'))).toBe(true);
    expect(warnings.some(w => w.includes('r-rota'))).toBe(true);
    expect(warnings.some(w => w.includes('boceto'))).toBe(true);
  });

  it('lee relaciones con accessType, strength, directed y extremos sobre relaciones', () => {
    expect(ws.relations['r-asg']).toMatchObject({ typeId: 'archimate:Assignment', from: { elementId: 'e-cliente' }, to: { elementId: 'e-vender' } });
    expect(ws.relations['r-acc']!.fields.accessType).toBe('read');
    expect(ws.relations['r-inf']!.fields.strength).toBe('++');
    expect(ws.relations['r-aso']!.fields.directed).toBe(true);
    expect(ws.relations['r-aso']!.to).toEqual({ relationId: 'r-srv' });
  });

  it('lee vistas con viewpoint, grupos, notas, referencias, anidamiento y bendpoints absolutos', () => {
    const v = ws.views['v1']!;
    expect(v.notationId).toBe('archimate');
    expect(v.viewpointId).toBe('layered');
    expect(v.props).toEqual({ estado: 'borrador' });
    expect(ws.nodes['g1']).toMatchObject({ visualType: 'core:group', text: 'Negocio', x: 100, y: 100, w: 400, h: 200, style: { fill: '#dafecb' } });
    expect(ws.nodes['n-cliente']).toMatchObject({ elementId: 'e-cliente', parentNodeId: 'g1', x: 20, y: 40 });
    expect(ws.nodes['n-vender']!.style).toEqual({ fill: '#ffff80', figure: 1 });
    expect(ws.nodes['nota1']).toMatchObject({ visualType: 'core:note', text: 'Una nota' });
    expect(ws.nodes['ref1']).toMatchObject({ detailViewId: 'v2', text: 'Vista 2' });
    expect(ws.nodes['n-crm']).toMatchObject({ w: 120, h: 55 });
    const e = ws.edges['c1']!;
    expect(e.relationId).toBe('r-asg');
    // centro del origen: (100+20+60, 100+40+27.5) = (180, 167.5)
    expect(e.bendpoints).toEqual([{ x: 240, y: 167.5 }]);
    expect(ws.edges['c-nota']!.relationId).toBeUndefined();
  });
});

describe('exportArchimate', () => {
  it('ida y vuelta conserva ids, tipos, propiedades, vistas y bendpoints', () => {
    const a = importArchimate(FIXTURE).workspace;
    const { text, warnings } = exportArchimate(a);
    expect(warnings).toEqual([]);
    expect(text).toContain('xsi:type="archimate:BusinessActor"');
    expect(text).toContain('accessType="1"');
    expect(text).toContain('directed="true"');
    expect(text).toContain('<profile name="VIP" id="p-vip" conceptType="BusinessActor"');
    expect(text).toContain('targetConnections="c1');
    const b = importArchimate(text).workspace;
    expect(Object.keys(b.elements).sort()).toEqual(Object.keys(a.elements).sort());
    expect(Object.keys(b.relations).sort()).toEqual(Object.keys(a.relations).sort());
    expect(Object.keys(b.nodes).sort()).toEqual(Object.keys(a.nodes).sort());
    expect(Object.keys(b.edges).sort()).toEqual(Object.keys(a.edges).sort());
    expect(b.elements['e-cliente']).toEqual(a.elements['e-cliente']);
    expect(b.relations['r-aso']).toEqual(a.relations['r-aso']);
    expect(b.nodes['n-vender']).toEqual(a.nodes['n-vender']);
    expect(b.edges['c1']).toEqual(a.edges['c1']);
    expect(b.views['v1']).toEqual(a.views['v1']);
    expect(b.libraries[ARCHIMATE_PROFILES_LIB]).toEqual(a.libraries[ARCHIMATE_PROFILES_LIB]);
  });

  it('omite lo que no es ArchiMate con aviso', () => {
    const a = importArchimate(FIXTURE).workspace;
    a.elements['x'] = { id: 'x', typeId: 'freeform:box', name: 'Caja', doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [] };
    a.views['vg'] = { id: 'vg', kind: 'grid', notationId: 'grid', name: 'Rejilla', doc: '', style: {}, props: {} };
    const { text, warnings } = exportArchimate(a);
    expect(text).not.toContain('freeform');
    expect(warnings.some(w => w.includes('Caja'))).toBe(true);
    expect(warnings.some(w => w.includes('Rejilla'))).toBe(true);
  });

  const sample = '/home/maka/projects/all-draw/_research/archi/tests/com.archimatetool.testsupport/testdata/models/Archisurance.archimate';
  it.skipIf(!existsSync(sample))('lee Archisurance de Archi y sobrevive a la ida y vuelta', () => {
    const a = importArchimate(readFileSync(sample, 'utf8'));
    expect(Object.keys(a.workspace.elements).length).toBeGreaterThan(100);
    expect(Object.keys(a.workspace.views).length).toBeGreaterThan(10);
    const b = importArchimate(exportArchimate(a.workspace).text);
    expect(Object.keys(b.workspace.nodes).length).toBe(Object.keys(a.workspace.nodes).length);
    expect(Object.keys(b.workspace.edges).length).toBe(Object.keys(a.workspace.edges).length);
    expect(b.workspace.relations).toEqual(a.workspace.relations);
  });
});
